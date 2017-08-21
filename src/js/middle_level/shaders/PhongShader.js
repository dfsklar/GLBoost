import DecalShader from './DecalShader';

export class PhongShaderSource {

  FSDefine_PhongShaderSource(in_, f, lights) {
    var shaderText = '';
    shaderText += `uniform vec3 viewPosition;\n`;
    shaderText += `uniform vec4 Kd;\n`;
    shaderText += `uniform vec4 Ks;\n`;
    shaderText += `uniform vec4 Ka;\n`;
    shaderText += `uniform float power;\n`;
    shaderText += `uniform float efficiencyAmbient;\n`;
    shaderText += `uniform float efficiencyDiffuse;\n`;
    shaderText += `uniform float efficiencySpecular;\n`;

    return shaderText;
  }

  FSShade_PhongShaderSource(f, gl, lights) {
    var shaderText = '';
    shaderText += '  vec4 surfaceColor = rt0;\n';
    shaderText += '  rt0 = vec4(0.0, 0.0, 0.0, 1.0);\n';
    shaderText += '  vec3 normal = normalize(v_normal);\n';

    // Ambient lighting is unconditional and not related to the number of lights in the scene
    shaderText += `    rt0 += vec4(efficiencyAmbient,efficiencyAmbient,efficiencyAmbient,1.0) * Ka * surfaceColor;\n`;
    
    shaderText += `  for (int i=0; i<${lights.length}; i++) {\n`;
    // if PointLight: lightPosition[i].w === 1.0      if DirectionalLight: lightPosition[i].w === 0.0
    shaderText += `    vec3 light = normalize(lightPosition[i].xyz - position.xyz * lightPosition[i].w);\n`;
    shaderText += `    float diffuse = max(dot(light, normal), 0.0);\n`;
    shaderText += `    rt0 += vec4(efficiencyDiffuse,efficiencyDiffuse,efficiencyDiffuse,1.0) * Kd * lightDiffuse[i] * vec4(diffuse, diffuse, diffuse, 1.0) * surfaceColor;\n`;
    shaderText += `    vec3 view = normalize(viewPosition - position.xyz);\n`;
    shaderText += `    vec3 reflect = reflect(-light, normal);\n`;
    shaderText += `    float specular = pow(max(dot(reflect, view), 0.0), power);\n`;
    shaderText += `    rt0 += vec4(efficiencySpecular,efficiencySpecular,efficiencySpecular,1.0) * Ks * lightDiffuse[i] * vec4(specular, specular, specular, 0.0);\n`;
    shaderText += `  }\n`;
//    shaderText += '  rt0 *= (1.0 - shadowRatio);\n';
    //shaderText += '  rt0.a = 1.0;\n';

    return shaderText;
  }

  prepare_PhongShaderSource(gl, shaderProgram, expression, vertexAttribs, existCamera_f, lights, material, extraData) {

    var vertexAttribsAsResult = [];

    material.setUniform(shaderProgram.hashId, 'uniform_Ka', gl.getUniformLocation(shaderProgram, 'Ka'));
    material.setUniform(shaderProgram.hashId, 'uniform_Kd', gl.getUniformLocation(shaderProgram, 'Kd'));
    material.setUniform(shaderProgram.hashId, 'uniform_Ks', gl.getUniformLocation(shaderProgram, 'Ks'));
    material.setUniform(shaderProgram.hashId, 'uniform_power', gl.getUniformLocation(shaderProgram, 'power'));

    material.setUniform(shaderProgram.hashId, 'uniform_efficiencyAmbient', gl.getUniformLocation(shaderProgram, 'efficiencyAmbient'));
    material.setUniform(shaderProgram.hashId, 'uniform_efficiencyDiffuse', gl.getUniformLocation(shaderProgram, 'efficiencyDiffuse'));
    material.setUniform(shaderProgram.hashId, 'uniform_efficiencySpecular', gl.getUniformLocation(shaderProgram, 'efficiencySpecular'));

    material.setUniform(shaderProgram.hashId, 'uniform_viewPosition', gl.getUniformLocation(shaderProgram, 'viewPosition'));

    return vertexAttribsAsResult;
  }
}



export default class PhongShader extends DecalShader {
  constructor(glBoostContext, basicShader) {

    super(glBoostContext, basicShader);
    PhongShader.mixin(PhongShaderSource);

    // DEFAULTS
    this._power = 64.0;  //default
    this._efficiencyAmbient = 1.0;
    this._efficiencyDiffuse = 1.0;
    this._efficiencySpecular = 1.0;
  }

  setUniforms(gl, glslProgram, expression, material) {
    super.setUniforms(gl, glslProgram, expression, material);

    // The names here are really incorrect.
    // "Kd" should be just a single-float coefficient of efficiency, not the vector4 color!
    var Kd = material.diffuseColor;
    var Ks = material.specularColor;
    var Ka = material.ambientColor;
    gl.uniform4f(material.getUniform(glslProgram.hashId, 'uniform_Ka'), Ka.x, Ka.y, Ka.z, Ka.w);
    gl.uniform4f(material.getUniform(glslProgram.hashId, 'uniform_Kd'), Kd.x, Kd.y, Kd.z, Kd.w);
    gl.uniform4f(material.getUniform(glslProgram.hashId, 'uniform_Ks'), Ks.x, Ks.y, Ks.z, Ks.w);
    gl.uniform1f(material.getUniform(glslProgram.hashId, 'uniform_power'), this._power);
    gl.uniform1f(material.getUniform(glslProgram.hashId, 'uniform_efficiencyAmbient'), this._efficiencyAmbient);
    gl.uniform1f(material.getUniform(glslProgram.hashId, 'uniform_efficiencyDiffuse'), this._efficiencyDiffuse);
    gl.uniform1f(material.getUniform(glslProgram.hashId, 'uniform_efficiencySpecular'), this._efficiencySpecular);
  }

  set efficiencyAmbient(value) {
    this._efficiencyAmbient = value;   
  }
  set efficiencyDiffuse(value) {
    this._efficiencyDiffuse = value;   
  }
  set efficiencySpecular(value) {
    this._efficiencySpecular = value;   
  }

  set Kd(value) {
    this._Kd = value;
  }

  get Kd() {
    return this._Kd;
  }

  set Ks(value) {
    this._Ks = value;
  }

  get Ks() {
    return this._Ks;
  }

  set power(value) {
    this._power = value;
  }

  get power() {
    return this._power;
  }
}

GLBoost['PhongShader'] = PhongShader;
