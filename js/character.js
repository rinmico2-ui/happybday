/**
 * Section-aware Three.js character controller.
 *
 * The model is rendered only inside the active .char-space. Locomotion happens
 * on a stable stage root while small acting offsets use a separate motion root,
 * so walking, turning and swaying never fight each other.
 */
class CharacterController {
  constructor(THREE, GLTFLoader) {
    this.THREE = THREE;
    this.GLTFLoader = GLTFLoader;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = null;
    this.stage = null;
    this.motionRoot = null;
    this.model = null;
    this.mixer = null;

    this.clips = {};
    this.actions = {};
    this.currentAction = null;
    this.currentState = null;
    this.gestureAction = null;
    this._onFinishCallbacks = [];

    this.modelHeight = 1;
    this.modelWidth = 1;
    this.isReady = false;
    this.isWalking = false;
    this.walkTarget = null;
    this.walkSpeed = 1.2;
    this._walkCallback = null;

    this._anchors = [];
    this._activeAnchor = null;
    this._targetYaw = 0;
    this._baseY = 0;
    this._elapsed = 0;
    this._swayActive = false;
    this._mood = 'neutral';
    this._blushMaterial = null;
    this._blushSprites = [];
    this._reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  init(canvas) {
    this.canvas = canvas;
    this.clock = new this.THREE.Clock();
    this.scene = new this.THREE.Scene();
    this.camera = new this.THREE.PerspectiveCamera(34, 1, 0.1, 100);

    this.renderer = new this.THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      premultipliedAlpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.autoClear = false;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = this.THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = this.THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = this.THREE.SRGBColorSpace;

    this.ambientLight = new this.THREE.AmbientLight(0xfff0e8, 0.72);
    this.scene.add(this.ambientLight);

    this.dirLight = new this.THREE.DirectionalLight(0xffe8d0, 1.05);
    this.dirLight.position.set(2, 5, 4);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(1024, 1024);
    this.dirLight.shadow.camera.near = 0.1;
    this.dirLight.shadow.camera.far = 20;
    this.dirLight.shadow.camera.left = -4;
    this.dirLight.shadow.camera.right = 4;
    this.dirLight.shadow.camera.top = 4;
    this.dirLight.shadow.camera.bottom = -4;
    this.dirLight.shadow.bias = -0.002;
    this.scene.add(this.dirLight);

    this.hemiLight = new this.THREE.HemisphereLight(0xd8c8f0, 0xf8d8c0, 0.45);
    this.scene.add(this.hemiLight);

    this.ground = new this.THREE.Mesh(
      new this.THREE.CircleGeometry(1.25, 64),
      new this.THREE.ShadowMaterial({ color: 0x080611, opacity: 0.22 })
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.006;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    this.stage = new this.THREE.Group();
    this.motionRoot = new this.THREE.Group();
    this.stage.add(this.motionRoot);
    this.scene.add(this.stage);

    window.addEventListener('resize', () => this._onResize(), { passive: true });
  }

  loadModel(path, onProgress) {
    return new Promise((resolve, reject) => {
      const loader = new this.GLTFLoader();
      loader.load(path, (gltf) => {
        this.model = gltf.scene;

        const box = new this.THREE.Box3().setFromObject(this.model);
        const size = new this.THREE.Vector3();
        const center = new this.THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        this.model.position.set(-center.x, -box.min.y, -center.z);
        this.model.traverse((child) => {
          if (!child.isMesh) return;
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) child.material.needsUpdate = true;
        });
        this.motionRoot.add(this.model);
        this._createBlush();

        this.modelHeight = size.y || 1;
        this.modelWidth = size.x || 1;
        this.ground.scale.setScalar(Math.max(size.x, size.z) * 0.72);

        this.camera.position.set(0, size.y * 0.54, size.y * 2.45);
        this.camera.lookAt(0, size.y * 0.52, 0);

        this.mixer = new this.THREE.AnimationMixer(this.model);
        (gltf.animations || []).forEach((clip) => {
          const key = clip.name.toLowerCase();
          let playableClip = clip;
          let blendMode = this.THREE.NormalAnimationBlendMode;

          if (key === 'wave') {
            playableClip = clip;
            blendMode = this.THREE.NormalAnimationBlendMode;
          }

          this.clips[key] = playableClip;
          const action = this.mixer.clipAction(playableClip, undefined, blendMode);
          action._clipName = key;
          this.actions[key] = action;
        });
        this.mixer.addEventListener('finished', (event) => {
          this._onAnimationFinished(event.action);
        });

        this.isReady = true;
        this.setAnchor('cs-intro');
        this.faceFront(true);
        this.play('idle', { fadeDuration: 0 });
        resolve();
      }, (progress) => {
        if (onProgress && progress.total) onProgress(progress.loaded / progress.total);
      }, (error) => {
        console.error('GLB load failed:', error);
        reject(error);
      });
    });
  }

  play(stateName, opts = {}) {
    if (!this.isReady) return this;

    const name = String(stateName).toLowerCase();
    if (name === 'wave' && !this.actions.wave) return this.play('idle', { fadeDuration: opts.fadeDuration ?? 0.3 });
    const action = this.actions[name] || this.actions.idle;
    if (!action) return this;
    if (name === 'wave') return this._playWave(action, opts);

    this._stopGesture();
    if (this.currentAction === action && action.isRunning() && !opts.restart) return this;

    const fadeDuration = opts.fadeDuration ?? 0.38;
    const shouldLoop = opts.loop ?? true;
    const previous = this.currentAction;

    action.enabled = true;
    action.setEffectiveWeight(1);
    action.setEffectiveTimeScale(opts.timeScale ?? this._timeScaleFor(name));
    action.setLoop(shouldLoop ? this.THREE.LoopRepeat : this.THREE.LoopOnce, shouldLoop ? Infinity : 1);
    action.clampWhenFinished = opts.clampWhenFinished ?? false;
    action.reset().play();

    if (previous && previous !== action) {
      action.crossFadeFrom(previous, fadeDuration, true);
    } else if (fadeDuration > 0) {
      action.fadeIn(fadeDuration);
    }

    this.currentAction = action;
    this.currentState = name;
    if (opts.onFinish) this._onFinishCallbacks.push({ action, callback: opts.onFinish });
    return this;
  }

  _playWave(action, opts) {
    if (this.currentState === 'walk' || this.currentState === 'run') {
      this.play('idle', { fadeDuration: 0.25 });
    }
    if (this.gestureAction === action && action.isRunning() && !opts.restart) return this;

    if (this.gestureAction) this.gestureAction.stop();
    action.stop();
    action.enabled = true;
    action.setEffectiveWeight(opts.weight ?? 1);
    action.setEffectiveTimeScale(opts.timeScale ?? this._timeScaleFor('wave'));
    action.setLoop(this.THREE.LoopOnce, 1);
    action.clampWhenFinished = false;
    action.reset().play();

    const baseAction = this.currentAction;
    if (baseAction && baseAction !== action && baseAction.isRunning()) {
      action.crossFadeFrom(baseAction, opts.fadeDuration ?? 0.28, true);
    } else {
      action.fadeIn(opts.fadeDuration ?? 0.28);
    }

    this.gestureAction = action;
    this.currentState = 'wave';
    if (opts.onFinish) this._onFinishCallbacks.push({ action, callback: opts.onFinish });
    return this;
  }

  _stopGesture() {
    if (!this.gestureAction) return;
    const gesture = this.gestureAction;
    gesture.stop();
    this._onFinishCallbacks = this._onFinishCallbacks.filter((entry) => entry.action !== gesture);
    this.gestureAction = null;
  }

  setAnchor(anchorOrIds) {
    const values = Array.isArray(anchorOrIds) ? anchorOrIds : [anchorOrIds];
    this._anchors = values
      .map((value) => typeof value === 'string' ? document.getElementById(value) : value)
      .filter(Boolean);
    this._activeAnchor = null;
    return this;
  }

  setMood(mood = 'neutral') {
    this._mood = mood;
    return this;
  }

  setPosition(x, y = 0, z = 0) {
    if (!this.stage) return this;
    this.stage.position.set(x, y, z);
    this._baseY = y;
    return this;
  }

  setRotation(y, immediate = false) {
    if (!this.stage) return this;
    this._targetYaw = y;
    if (immediate) this.stage.rotation.y = y;
    return this;
  }

  faceFront(immediate = false) {
    return this.setRotation(0, immediate);
  }

  cancelMovement() {
    this.isWalking = false;
    this.walkTarget = null;
    this._walkCallback = null;
    return this;
  }

  walkTo(x, y = 0, z = 0, opts = {}) {
    if (!this.isReady) return this;
    this.walkTarget = new this.THREE.Vector3(x, y, z);
    this.walkSpeed = opts.speed ?? this.modelHeight * 0.72;
    this.isWalking = true;
    this._walkCallback = opts.onArrive || null;

    const dx = x - this.stage.position.x;
    // The rig faces the camera at yaw 0. Turn a quarter turn before translating
    // sideways so the feet travel in the same direction as the walk cycle.
    if (Math.abs(dx) > 0.001) this.setRotation(dx > 0 ? Math.PI / 2 : -Math.PI / 2);
    this.play('walk');
    return this;
  }

  enterFrom(direction = 'left', opts = {}) {
    if (!this.isReady) return this;
    const sign = direction === 'right' ? 1 : -1;
    const start = sign * this.modelHeight * (opts.distance ?? 0.72);
    const destination = opts.to ?? 0;

    this.stopSway();
    this.cancelMovement();
    this.setPosition(start, 0, 0);
    this.setRotation(-sign * Math.PI / 2, true);

    if (this._reducedMotion) {
      this.setPosition(destination, 0, 0).faceFront(true).play('idle');
      if (opts.onArrive) opts.onArrive();
      return this;
    }

    return this.walkTo(destination, 0, 0, {
      speed: opts.speed ?? this.modelHeight * 0.62,
      onArrive: () => {
        this.faceFront();
        this.play('idle');
        window.setTimeout(() => {
          if (opts.onArrive) opts.onArrive();
        }, 260);
      }
    });
  }

  startSway() {
    this._swayActive = !this._reducedMotion;
    return this;
  }

  stopSway() {
    this._swayActive = false;
    if (this.motionRoot) {
      this.motionRoot.position.set(0, 0, 0);
      this.motionRoot.rotation.set(0, 0, 0);
    }
    return this;
  }

  setAtmosphere(name) {
    const configs = {
      night: [0xaaaadd, 0.56, 0xd8d8ff, 0.72, 0x8888bb, 0.34],
      warm: [0xfff0e8, 0.78, 0xffdfbd, 1.08, 0xead7ee, 0.48],
      cozy: [0xfff0e0, 0.75, 0xffdfc0, 1.0, 0xe5d3ee, 0.44],
      moonlit: [0xb0b0df, 0.62, 0xccccff, 0.82, 0x8888c0, 0.38],
      celebrate: [0xfff0e8, 0.92, 0xffd9c2, 1.24, 0xf1d8ee, 0.58]
    };
    const c = configs[name];
    if (!c) return this;
    this.ambientLight.color.setHex(c[0]);
    this.ambientLight.intensity = c[1];
    this.dirLight.color.setHex(c[2]);
    this.dirLight.intensity = c[3];
    this.hemiLight.color.setHex(c[4]);
    this.hemiLight.intensity = c[5];
    return this;
  }

  update() {
    if (!this.renderer) return;
    const delta = Math.min(this.clock.getDelta(), 0.05);
    this.renderer.setScissorTest(false);
    this.renderer.clear(true, true, true);
    if (!this.isReady) return;

    this._elapsed += delta;
    if (this.mixer) this.mixer.update(delta);
    this._updateLocomotion(delta);
    this._updateActing(delta);
    this._renderAtActiveAnchor();
  }

  _updateLocomotion(delta) {
    this.stage.rotation.y = this._dampAngle(this.stage.rotation.y, this._targetYaw, 12, delta);
    if (!this.isWalking || !this.walkTarget) return;

    const offset = this.walkTarget.clone().sub(this.stage.position);
    const distance = offset.length();
    if (distance <= 0.018) {
      this.stage.position.copy(this.walkTarget);
      this._baseY = this.stage.position.y;
      this.isWalking = false;
      this.walkTarget = null;
      const callback = this._walkCallback;
      this._walkCallback = null;
      this.faceFront();
      this.play('idle');
      if (callback) callback();
      return;
    }

    const amount = Math.min(distance, this.walkSpeed * delta);
    this.stage.position.addScaledVector(offset.normalize(), amount);
  }

  _updateActing(delta) {
    if (!this.motionRoot) return;
    const sway = this._swayActive ? 1 : 0;
    const moodTilt = this._mood === 'shy' ? -0.035 : this._mood === 'thoughtful' ? 0.018 : 0;
    const targetX = sway * Math.sin(this._elapsed * 1.8) * this.modelHeight * 0.018;
    const targetY = sway * (0.5 + 0.5 * Math.sin(this._elapsed * 3.6)) * this.modelHeight * 0.008;
    const targetZ = moodTilt + sway * Math.sin(this._elapsed * 1.8) * 0.028;
    const amount = 1 - Math.exp(-7 * delta);

    this.motionRoot.position.x += (targetX - this.motionRoot.position.x) * amount;
    this.motionRoot.position.y += (targetY - this.motionRoot.position.y) * amount;
    this.motionRoot.rotation.z += (targetZ - this.motionRoot.rotation.z) * amount;

    // A raised hand is taller than the model's bind-pose bounds. Ease the
    // camera back only while waving so the hand never clips at small stages.
    const cameraDistance = this.modelHeight * (this.gestureAction ? 2.72 : 2.45);
    this.camera.position.z += (cameraDistance - this.camera.position.z) * (1 - Math.exp(-6 * delta));
    this.camera.lookAt(0, this.modelHeight * 0.52, 0);

    if (this._blushMaterial) {
      const pulse = 0.8 + Math.sin(this._elapsed * 2.2) * 0.04;
      const blushTarget = this._mood === 'shy' ? pulse : 0;
      this._blushMaterial.opacity += (blushTarget - this._blushMaterial.opacity) * amount;
      const showBlush = this._blushMaterial.opacity > 0.01;
      this._blushSprites.forEach((cheek) => {
        cheek.visible = showBlush;
        cheek.position.copy(cheek.userData.headLocal);
        this._blushHead.localToWorld(cheek.position);
      });
    }
  }

  _renderAtActiveAnchor() {
    const anchor = this._pickAnchor();
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const left = Math.max(0, rect.left);
    const right = Math.min(window.innerWidth, rect.right);
    const top = Math.max(0, rect.top);
    const bottom = Math.min(window.innerHeight, rect.bottom);
    const width = Math.max(0, right - left);
    const height = Math.max(0, bottom - top);
    if (width < 8 || height < 8) return;

    // Keep projection tied to the full stage, even while it is partly leaving
    // the viewport. Only the scissor is clipped, preventing scroll-time zoom.
    this.camera.aspect = rect.width / rect.height;
    this.camera.fov = width < 260 ? 38 : 34;
    this.camera.updateProjectionMatrix();

    this.renderer.setViewport(rect.left, window.innerHeight - rect.bottom, rect.width, rect.height);
    this.renderer.setScissor(left, window.innerHeight - bottom, width, height);
    this.renderer.setScissorTest(true);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setScissorTest(false);
  }

  _pickAnchor() {
    let best = null;
    let bestDistance = Infinity;
    const viewportCenter = window.innerHeight / 2;

    this._anchors.forEach((anchor) => {
      if (!anchor || anchor.offsetParent === null) return;
      const rect = anchor.getBoundingClientRect();
      const visible = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
      if (visible <= 0) return;
      const distance = Math.abs((rect.top + rect.bottom) / 2 - viewportCenter);
      if (distance < bestDistance) {
        best = anchor;
        bestDistance = distance;
      }
    });

    if (best !== this._activeAnchor) this._activeAnchor = best;
    return this._activeAnchor;
  }

  _onAnimationFinished(action) {
    const callbacks = this._onFinishCallbacks.filter((entry) => entry.action === action);
    this._onFinishCallbacks = this._onFinishCallbacks.filter((entry) => entry.action !== action);
    if (action._clipName === 'wave' && this.gestureAction === action) {
      this.gestureAction = null;
      this.currentState = this.currentAction ? this.currentAction._clipName : 'idle';
    }
    callbacks.forEach((entry) => entry.callback());
  }

  _createBlush() {
    const head = this.model && this.model.getObjectByName('Head');
    if (!head) return;
    this._blushHead = head;

    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = 96;
    textureCanvas.height = 48;
    const context = textureCanvas.getContext('2d');
    const gradient = context.createRadialGradient(48, 24, 2, 48, 24, 34);
    gradient.addColorStop(0, 'rgba(255, 62, 112, 0.78)');
    gradient.addColorStop(0.52, 'rgba(255, 104, 143, 0.48)');
    gradient.addColorStop(1, 'rgba(255, 145, 171, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 96, 48);
    context.strokeStyle = 'rgba(255, 220, 228, 0.65)';
    context.lineWidth = 3;
    [34, 48, 62].forEach((x) => {
      context.beginPath();
      context.moveTo(x - 5, 29);
      context.lineTo(x + 3, 18);
      context.stroke();
    });

    const texture = new this.THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = this.THREE.SRGBColorSpace;
    this._blushMaterial = new this.THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      toneMapped: false
    });

    [-1, 1].forEach((side) => {
      const cheek = new this.THREE.Sprite(this._blushMaterial);
      cheek.userData.headLocal = new this.THREE.Vector3(side * 0.072, -0.038, 0.18);
      cheek.scale.set(0.105, 0.045, 1);
      cheek.renderOrder = 20;
      cheek.frustumCulled = false;
      cheek.visible = false;
      this.scene.add(cheek);
      this._blushSprites.push(cheek);
    });
  }

  _timeScaleFor(name) {
    if (this._reducedMotion) return 0.55;
    return { idle: 0.88, walk: 0.95, run: 0.9, wave: 0.85 }[name] ?? 1;
  }

  _dampAngle(current, target, speed, delta) {
    const circle = Math.PI * 2;
    let difference = (target - current + Math.PI) % circle - Math.PI;
    if (difference < -Math.PI) difference += circle;
    return current + difference * (1 - Math.exp(-speed * delta));
  }

  _onResize() {
    if (!this.renderer) return;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }
}
