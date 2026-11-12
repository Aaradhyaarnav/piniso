// Piniso 3D runtime: only the parts of three.js we use, exposed as globalThis.PZ3
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, MeshPhysicalMaterial, MeshBasicMaterial, Color, Vector3,
  PMREMGenerator, DirectionalLight, HemisphereLight, PlaneGeometry, CanvasTexture, SRGBColorSpace, NeutralToneMapping,
  BackSide, Sprite, SpriteMaterial, MathUtils, Object3D, AdditiveBlending
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
globalThis.PZ3 = {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, MeshPhysicalMaterial, MeshBasicMaterial, Color, Vector3,
  PMREMGenerator, DirectionalLight, HemisphereLight, PlaneGeometry, CanvasTexture, SRGBColorSpace, NeutralToneMapping,
  BackSide, Sprite, SpriteMaterial, MathUtils, Object3D, AdditiveBlending, GLTFLoader, RoomEnvironment
};
