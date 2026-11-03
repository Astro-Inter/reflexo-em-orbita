import { useEffect, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { createAstrinho } from "./astrinho";
import type { Outcome, Phase } from "../game/engine";

type Props = {
  phase: Phase;
  outcome: Outcome;
  onReady: () => void;
  onError: () => void;
};
export function SpaceScene({ phase, outcome, onReady, onError }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const update = useRef<(phase: Phase, outcome: Outcome) => void>(() => {});
  useLayoutEffect(() => {
    update.current(phase, outcome);
  }, [phase, outcome]);
  useEffect(() => {
    const element = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      onError();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    element.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0.25, 10.5);
    camera.lookAt(0, 0.12, 0);
    scene.add(new THREE.HemisphereLight("#f1efff", "#433653", 2));
    const key = new THREE.DirectionalLight("#fff3e8", 3.2);
    key.position.set(-3, 5, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight("#bdabf6", 1.8);
    rim.position.set(4, 2, -3);
    scene.add(rim);
    const fill = new THREE.DirectionalLight("#698cff", 0.8);
    fill.position.set(-4, -1, 2);
    scene.add(fill);
    const mascot = createAstrinho();
    scene.add(mascot.root);
    let state: Phase = "IDLE";
    let result: Outcome = null;
    let stateSince = performance.now();
    let reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const changeMotion = () => {
      reduced = media.matches;
    };
    media.addEventListener("change", changeMotion);
    function pose(now: number, delta: number) {
      const t = now / 1000;
      const age = (now - stateSince) / 1000;
      const happy = state === "RESULT" && result === "won";
      const sad =
        state === "FEEDBACK" || (state === "RESULT" && result === "lost");
      const focusing = state === "WAITING";
      const alert = state === "REACTION";
      const blend = reduced ? 1 : 1 - Math.exp(-delta * 7);
      const lerp = (a: number, b: number) => THREE.MathUtils.lerp(a, b, blend);
      const idleMotion = reduced ? 0 : 1;
      const celebration =
        happy && !reduced ? Math.exp(-Math.max(0, age - 0.3) / 1.8) : 0;
      mascot.root.position.y = reduced
        ? 0
        : Math.sin(t * 1.5) * 0.09 * idleMotion +
          (happy
            ? Math.abs(Math.sin(age * 6.2)) * 0.27 * celebration
            : sad
              ? -0.12
              : 0);
      mascot.root.rotation.x = lerp(
        mascot.root.rotation.x,
        sad
          ? 0.05
          : focusing
            ? -0.13
            : -0.21 + Math.sin(age * 8) * 0.06 * celebration,
      );
      mascot.root.rotation.y = lerp(
        mascot.root.rotation.y,
        (focusing ? 0.06 : 0.13) +
          (reduced ? 0 : Math.sin(t * 0.6) * 0.095 * idleMotion),
      );
      mascot.root.rotation.z = lerp(
        mascot.root.rotation.z,
        (alert ? -0.13 : sad ? 0.035 : -0.105) +
          (reduced ? 0 : Math.sin(t * 0.9) * 0.035 * idleMotion) +
          Math.sin(age * 7.5) * 0.14 * celebration,
      );
      mascot.wings.forEach((wing, i) => {
        const side = i === 0 ? -1 : 1;
        wing.rotation.z = lerp(
          wing.rotation.z,
          side *
            (happy
              ? 0.65 + Math.sin(age * 10 + i * 0.8) * 0.14 * celebration
              : sad
                ? -0.22
                : alert
                  ? 0.42
                  : focusing
                    ? 0.015
                    : 0.05 + (reduced ? 0 : Math.sin(t * 1.4 + i) * 0.07)),
        );
        wing.rotation.y = lerp(wing.rotation.y, side * -0.09);
      });
      mascot.happyEyes.forEach((eye, index) => {
        eye.rotation.z =
          (index === 0 ? -1 : 1) * 0.07 +
          Math.sin(age * 7) * 0.035 * celebration;
      });
      const blink =
        !reduced &&
        !alert &&
        !happy &&
        !sad &&
        !focusing &&
        Math.sin(t * 1.1) > 0.995;
      // Close smoothly from the start, finish at 5s, then hold until the
      // independently randomized alert (3–6s) appears.
      const focusProgress = reduced ? 1 : Math.min(age / 5, 1);
      const easedFocus = focusProgress * focusProgress * (3 - 2 * focusProgress);
      const focusedHeight = 0.265 - 0.21 * easedFocus;
      mascot.eyes.forEach((eye) => {
        if (focusing) eye.scale.y = focusedHeight;
        else
          eye.scale.y = lerp(
            eye.scale.y,
            blink
              ? 0.045
              : happy
                ? 0.15
                : sad
                  ? 0.1
                  : alert
                    ? 0.31
                    : 0.265,
          );
        eye.rotation.z = lerp(
          eye.rotation.z,
          sad
            ? eye.position.x < 0
              ? 0.32
              : -0.32
            : happy
              ? eye.position.x < 0
                ? -0.12
                : 0.12
              : 0,
        );
      });
    }
    update.current = (next, nextResult) => {
      if (next === state && nextResult === result) return;
      state = next;
      result = nextResult;
      stateSince = performance.now();
      const won = next === "RESULT" && nextResult === "won";
      mascot.eyes.forEach((eye) => {
        eye.visible = !won;
      });
      mascot.happyEyes.forEach((eye) => {
        eye.visible = won;
      });
      mascot.eyeMaterial.color.set(
        next === "REACTION"
          ? "#ff4545"
          : nextResult === "won"
            ? "#32ff7a"
            : next === "FEEDBACK" || nextResult === "lost"
              ? "#d9cce8"
              : "#ffffff",
      );
      mascot.engineMaterial.color.set(
        next === "REACTION" ? "#ff303a" : won ? "#32ff7a" : "#ac45ff",
      );
      rim.color.set(won ? "#5aff9b" : "#bdabf6");
      // Critical visual cue is immediate; pose interpolation is decorative.
      if (next === "REACTION")
        mascot.eyes.forEach((eye) => {
          eye.scale.y = 0.31;
        });
      renderer.render(scene, camera);
    };
    function resize() {
      const { width, height } = element.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      // Leave a margin around the full wingspan, including its alert pose.
      camera.position.z = Math.max(7.8, 9.4 / camera.aspect);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    }
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    let frame = 0;
    let last = performance.now();
    function animate(now: number) {
      frame = requestAnimationFrame(animate);
      if (document.hidden) return;
      pose(now, Math.min((now - last) / 1000, 0.1));
      last = now;
      renderer.render(scene, camera);
    }
    pose(last, 1);
    renderer.render(scene, camera);
    frame = requestAnimationFrame(animate);
    const lost = (event: Event) => {
      event.preventDefault();
      onError();
    };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    onReady();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      media.removeEventListener("change", changeMotion);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      update.current = () => {};
    };
  }, [onReady, onError]);
  return (
    <div
      className="space-scene"
      ref={host}
      role="img"
      aria-label="Astrinho em 3D: satélite branco, olhos ovais e painéis solares roxos"
    />
  );
}
