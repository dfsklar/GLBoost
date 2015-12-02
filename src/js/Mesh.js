import GLBoost from './globals'
import Element from './Element'
import Matrix44 from './math/Matrix44'
import Vector4 from './math/Vector4'
import GLContext from './GLContext'
import GLExtentionsManager from './GLExtentionsManager'
import Shader from './shaders/Shader'
import SimpleShader from './shaders/SimpleShader'
import PointLight from './lights/PointLight'
import DirectionalLight from './lights/DirectionalLight'

export default class Mesh extends Element {
  constructor(canvas) {
    super();
    this._gl = GLContext.getInstance(canvas).gl;
    this._canvas = canvas;
    this._material = null;
    this._vertexN = 0;
    this._stride = 0;
    this._glslProgram = null;
    this._vertices = null;
    this._shader_for_non_material = new SimpleShader(this._canvas);
  }

  /**
   * データとして利用する頂点属性を判断し、そのリストを返す
   * 不必要な頂点属性のデータは無視する。
   */
  _decideNeededVertexAttribs(vertices) {
    var attribNameArray = [];
    for (var attribName in vertices) {
      if (attribName === GLBoost.TEXCOORD) {
        // texcoordの場合は、テクスチャ付きのマテリアルをちゃんと持っているときに限り、'texcoord'が有効となる
        if ((this._materials[0] !== null) && this._materials[0].diffuseTexture !== null) {
          attribNameArray.push(attribName);
        } else {
          delete vertices[GLBoost.TEXCOORD];
        }
      } else {
        if (attribName !== 'indices') {// && attribName !== 'normal') {
          attribNameArray.push(attribName);
        }
      }
    }

    return attribNameArray;
  }

  _getSheder(result, existCamera_f, lights) {
    return this._shader_for_non_material.getShaderProgram(result, existCamera_f, lights);
  }

  setVerticesData(vertices) {
    this._vertices = vertices;
  }

  prepareForRender(existCamera_f, lights) {
    var vertices = this._vertices;
    var gl = this._gl;

    var glem = GLExtentionsManager.getInstance(gl);

    var optimizedVertexAttribs = this._decideNeededVertexAttribs(vertices);

    // create VAO
    var vao = glem.createVertexArray(gl);
    glem.bindVertexArray(gl, vao);

    // create VBO
    var verticesBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, verticesBuffer);

    var setVerticesLayout = (glslProgram)=> {
      optimizedVertexAttribs = glslProgram.optimizedVertexAttribs;

      this._stride = 0;
      optimizedVertexAttribs.forEach((attribName)=> {
        var numberOfComponentOfVector = (vertices[attribName][0].z === void 0) ? 2 : 3;
        this._stride += numberOfComponentOfVector * 4;
      });

      // 頂点レイアウト設定
      var offset = 0;
      optimizedVertexAttribs.forEach((attribName)=> {
        gl.enableVertexAttribArray(glslProgram['vertexAttribute_' + attribName]);
        var numberOfComponentOfVector = (vertices[attribName][0].z === void 0) ? 2 : 3;
        gl.vertexAttribPointer(glslProgram['vertexAttribute_' + attribName],
          numberOfComponentOfVector, gl.FLOAT, gl.FALSE, this._stride, offset);
        offset += numberOfComponentOfVector * 4;
      });
    };

    let materials = this._materials;
    if (materials) {
      for (let i=0; i<materials.length;i++) {
        // GLSLプログラム作成。
        var glslProgram = materials[i].shader.getShaderProgram(optimizedVertexAttribs, existCamera_f, lights);
        setVerticesLayout(glslProgram);
        materials[i].glslProgram = glslProgram;
      }
    } else {
      var glslProgram = this._getSheder(optimizedVertexAttribs, existCamera_f, lights);
      setVerticesLayout(glslProgram);
      this._glslProgram = glslProgram;
    }

    this._vertexN = vertices.position.length;

    var vertexData = [];

    vertices.position.forEach((elem, index, array) => {
      optimizedVertexAttribs.forEach((attribName)=> {
        var element = vertices[attribName][index];
        vertexData.push(element.x);
        vertexData.push(element.y);
        if (element.z !== void 0) {
          vertexData.push(element.z);
        }
      });
    });

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexData), gl.STATIC_DRAW);


    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    this._indicesBuffers = [];
    this._indicesNArray = [];
    if (vertices.indices) {
      // create Index Buffer
      for (let i=0; i<vertices.indices.length; i++) {
        this._indicesBuffers[i] = gl.createBuffer();
        this._indicesNArray[i] = vertices.indices[i].length;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indicesBuffers[i] );
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(vertices.indices[i]), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
      }
    }
    glem.bindVertexArray(gl, null)

    this._vao = vao;

    // if this mesh has only one material...
    if (this._materials && this._materials.length === 1 && this._materials[0].faceN === 0) {
      if (vertices.indices && vertices.indices.length > 0) {
        this._materials[0].faceN = vertices.indices[0].length / 3;
      } else {
        this._materials[0].faceN = this._vertexN / 3;
      }
    }

  }

  draw(viewMatrix, projectionMatrix, lights, camera) {
    var gl = this._gl;
    var glem = GLExtentionsManager.getInstance(gl);
    var materials = this._materials;

    glem.bindVertexArray(gl, this._vao);

    if (materials) {
      for (let i=0; i<materials.length;i++) {
        let glslProgram = materials[i].glslProgram;
        gl.useProgram(glslProgram);

        if (viewMatrix && projectionMatrix) {
          var mvp_m = projectionMatrix.clone().multiply(viewMatrix).multiply(this.transformMatrix);
          gl.uniformMatrix4fv(glslProgram.modelViewProjectionMatrix, false, new Float32Array(mvp_m.transpose().flatten()));
        }

        if (typeof glslProgram.modelViewMatrix !== "undefined") {
          var mv_m = viewMatrix.clone().multiply(this.transformMatrix);
          gl.uniformMatrix4fv(glslProgram.modelViewMatrix, false, new Float32Array(mv_m.clone().transpose().flatten()));
        }

        if (typeof glslProgram.invNormalMatrix !== "undefined") {
          var in_m = mv_m.toMatrix33().invert();
          gl.uniformMatrix3fv(glslProgram.invNormalMatrix, false, new Float32Array(in_m.flatten()));
        }

        lights = Shader.getDefaultPointLightIfNotExsist(gl, lights);

        if (lights.length !== 0) {
          for(let j=0; j<lights.length; j++) {
            if (glslProgram[`lightPosition_${j}`] && glslProgram[`lightDiffuse_${j}`]) {
              let lightVec = null;
              if (lights[j] instanceof PointLight) {
                lightVec = new Vector4(lights[j].translate.x, lights[j].translate.y, lights[j].translate.z, 1.0);
              } else if (lights[j] instanceof DirectionalLight) {
                lightVec = new Vector4(-lights[j].direction.x, -lights[j].direction.y, -lights[j].direction.z, 0.0);
              }

              if (camera) {
                let lightVecInCameraCoord = viewMatrix.multiplyVector(lightVec);
                gl.uniform4f(glslProgram[`lightPosition_${j}`], lightVecInCameraCoord.x, lightVecInCameraCoord.y, lightVecInCameraCoord.z, lightVec.w);
              } else {
                gl.uniform4f(glslProgram[`lightPosition_${j}`], lightVec.x, lightVec.y, lightVec.z, lightVec.w);
              }
              gl.uniform4f(glslProgram[`lightDiffuse_${j}`], lights[j].intensity.x, lights[j].intensity.y, lights[j].intensity.z, 1.0);
            }
          }
        }

        if (typeof materials[i].shader.setUniforms !== "undefined") {
          materials[i].shader.setUniforms(gl, glslProgram);
        }

        if (materials[i]) {
          materials[i].setUp();
        }

        if (this._indicesBuffers.length > 0) {
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indicesBuffers[i] );
          gl.drawElements(gl.TRIANGLES, materials[i].faceN*3, gl.UNSIGNED_SHORT, 0);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        } else {
          gl.drawArrays(gl.TRIANGLES, 0, this._vertexN);
        }

        if (materials[i]) {
          materials[i].tearDown();
        }
      }
    } else {
      gl.useProgram(this._glslProgram);

      if (viewMatrix && projectionMatrix) {
        var mvp_m = projectionMatrix.clone().multiply(viewMatrix).multiply(this.transformMatrix);
        gl.uniformMatrix4fv(this._glslProgram.modelViewProjectionMatrix, false, new Float32Array(mvp_m.transpose().flatten()));
      }

      if (this._indicesBuffers.length > 0) {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indicesBuffers[0] );
        gl.drawElements(gl.TRIANGLES, this._indicesNArray[0], gl.UNSIGNED_SHORT, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
      } else {
        gl.drawArrays(gl.TRIANGLES, 0, this._vertexN);
      }
    }

    glem.bindVertexArray(gl, null);
  }

  set materials(materials) {
    this._materials = materials;
  }
}

GLBoost["Mesh"] = Mesh;
