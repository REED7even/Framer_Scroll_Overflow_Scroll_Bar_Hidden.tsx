import React, { useEffect, useRef } from "react"
import { addPropertyControls, ControlType } from "framer"
import * as THREE from "https://esm.sh/three@0.160.0"
import gsap from "https://esm.sh/gsap@3.12.5"

const BRIGHT_NATURE_IDS = [
    11, 13, 14, 15, 16, 17, 28, 29, 38, 46, 49, 54, 57, 58, 69, 74, 103, 104,
    114, 122,
]
const DEFAULT_IMAGES = BRIGHT_NATURE_IDS.map(
    (id) => `https://picsum.photos/id/${id}/800/1200`
)

/**
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */
export default function CinematicCarousel(props) {
    const {
        images: userImages,
        cardWidth,
        cardHeight,
        gap,
        cylinderRadius,
        arcLength,
        backgroundColor,
        style,
    } = props

    const containerRef = useRef<HTMLDivElement>(null)

    const images =
        userImages && userImages.length > 0 ? userImages : DEFAULT_IMAGES

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        let width = container.clientWidth
        let height = container.clientHeight

        const scene = new THREE.Scene()
        scene.background = new THREE.Color(backgroundColor)
        scene.fog = new THREE.Fog(backgroundColor, 10, 30)

        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)
        camera.position.set(0, 0, 15)

        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false,
        })
        renderer.setSize(width, height)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        container.appendChild(renderer.domElement)

        const carousel = new THREE.Group()
        scene.add(carousel)

        const N = images.length
        const spacing = cardWidth + gap
        const totalLength = N * spacing

        const R = cylinderRadius
        const L = arcLength

        const baseGeometry = new THREE.PlaneGeometry(
            cardWidth,
            cardHeight,
            32,
            1
        )

        const textureLoader = new THREE.TextureLoader()
        textureLoader.setCrossOrigin("anonymous")

        const meshes: THREE.Mesh[] = []

        images.forEach((url, i) => {
            const baseColor = new THREE.Color().setHSL(i / N, 0.8, 0.5)

            const material = new THREE.ShaderMaterial({
                uniforms: {
                    tDiffuse: { value: null },
                    uParallax: { value: 0.0 },
                    uHasTexture: { value: 0.0 },
                    uColor: { value: baseColor.clone() },
                    uBrightness: { value: 1.0 },
                },
                vertexShader: `
                    varying vec2 vUv;
                    void main() {
                        vUv = uv;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `,
                fragmentShader: `
                    uniform sampler2D tDiffuse;
                    uniform float uParallax;
                    uniform float uHasTexture;
                    uniform vec3 uColor;
                    uniform float uBrightness;
                    varying vec2 vUv;
                    void main() {
                        vec2 uv = vUv;
                        
                        // Zoom in 25% for parallax margin
                        uv = (uv - 0.5) * 0.75 + 0.5;
                        uv.x += uParallax * 0.12; // Parallax shift
                        
                        if (uHasTexture > 0.5) {
                            vec4 texColor = texture2D(tDiffuse, uv);
                            gl_FragColor = vec4(texColor.rgb * uBrightness, texColor.a);
                        } else {
                            gl_FragColor = vec4(uColor * uBrightness, 1.0);
                        }
                    }
                `,
                side: THREE.DoubleSide,
                transparent: true,
            })

            const geometry = baseGeometry.clone()
            const mesh = new THREE.Mesh(geometry, material)
            mesh.userData = { index: i, hover: 0, baseColor }

            carousel.add(mesh)
            meshes.push(mesh)

            textureLoader.load(
                url,
                (texture) => {
                    texture.colorSpace = THREE.SRGBColorSpace
                    material.uniforms.tDiffuse.value = texture
                    material.uniforms.uHasTexture.value = 1.0
                },
                undefined,
                (err) => {
                    console.error("Error loading texture", url, err)
                }
            )
        })

        let scrollOffset = 0
        let targetScroll = 0
        let isDragging = false
        let startX = 0
        let lastX = 0
        let hoveredMesh: THREE.Mesh | null = null

        const raycaster = new THREE.Raycaster()
        const mouse = new THREE.Vector2()

        const onWheel = (e: WheelEvent) => {
            e.preventDefault()
            targetScroll -= e.deltaY * 0.005
            targetScroll -= e.deltaX * 0.005
        }

        const onPointerDown = (e: PointerEvent) => {
            isDragging = true
            startX = e.clientX
            lastX = e.clientX
            container.style.cursor = "grabbing"
            container.setPointerCapture(e.pointerId)
        }

        const onPointerMove = (e: PointerEvent) => {
            if (isDragging) {
                const deltaX = e.clientX - lastX
                targetScroll += deltaX * 0.015
                lastX = e.clientX
            }

            const rect = container.getBoundingClientRect()
            mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
            mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

            raycaster.setFromCamera(mouse, camera)
            const intersects = raycaster.intersectObjects(meshes)

            if (intersects.length > 0) {
                hoveredMesh = intersects[0].object as THREE.Mesh
                if (!isDragging) container.style.cursor = "pointer"
            } else {
                hoveredMesh = null
                if (!isDragging) container.style.cursor = "grab"
            }
        }

        const onPointerUp = (e: PointerEvent) => {
            isDragging = false
            container.style.cursor = hoveredMesh ? "pointer" : "grab"
            container.releasePointerCapture(e.pointerId)
        }

        const onClick = (e: MouseEvent) => {
            if (Math.abs(e.clientX - startX) > 5) return

            if (hoveredMesh) {
                const index = hoveredMesh.userData.index
                const targetA = -index * spacing
                const currentA = targetScroll
                const diff = targetA - currentA

                let normalizedDiff = diff % totalLength
                if (normalizedDiff > totalLength / 2)
                    normalizedDiff -= totalLength
                if (normalizedDiff < -totalLength / 2)
                    normalizedDiff += totalLength

                gsap.to(
                    { val: targetScroll },
                    {
                        val: targetScroll + normalizedDiff,
                        duration: 1.2,
                        ease: "power3.out",
                        onUpdate: function () {
                            targetScroll = this.targets()[0].val
                        },
                    }
                )
            }
        }

        const resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                width = entry.contentRect.width
                height = entry.contentRect.height
                camera.aspect = width / height
                camera.updateProjectionMatrix()
                renderer.setSize(width, height)
            }
        })
        resizeObserver.observe(container)

        container.addEventListener("wheel", onWheel, { passive: false })
        container.addEventListener("pointerdown", onPointerDown)
        container.addEventListener("pointermove", onPointerMove)
        container.addEventListener("pointerup", onPointerUp)
        container.addEventListener("pointercancel", onPointerUp)
        container.addEventListener("click", onClick)

        const clock = new THREE.Clock()
        let animationFrameId: number

        const tick = () => {
            const dt = Math.min(clock.getDelta(), 0.1)
            scrollOffset += (targetScroll - scrollOffset) * 5 * dt

            meshes.forEach((mesh, i) => {
                let rawU = i * spacing + scrollOffset
                let uOffset =
                    ((rawU + totalLength / 2) % totalLength) - totalLength / 2
                if (uOffset < -totalLength / 2) uOffset += totalLength

                const positionAttribute = mesh.geometry.attributes.position
                const baseArray = baseGeometry.attributes.position.array
                const posArray = positionAttribute.array as Float32Array

                for (let j = 0; j < positionAttribute.count; j++) {
                    const baseX = baseArray[j * 3]
                    const baseY = baseArray[j * 3 + 1]

                    const u = baseX + uOffset
                    let x, z
                    let scaleY = 1.0

                    if (Math.abs(u) <= L) {
                        const theta = u / R
                        x = R * Math.sin(theta)
                        z = R * Math.cos(theta) - R
                        const factor = Math.cos((u / L) * (Math.PI / 2))
                        scaleY = 1.0 + factor * 0.15
                    } else {
                        const isPositive = u > 0
                        const excess = isPositive ? u - L : u + L
                        const edgeTheta = isPositive ? L / R : -L / R
                        x =
                            R * Math.sin(edgeTheta) +
                            excess * Math.cos(edgeTheta)
                        z =
                            R * Math.cos(edgeTheta) -
                            R -
                            excess * Math.sin(edgeTheta)
                    }

                    z += 2.0
                    posArray[j * 3] = x
                    posArray[j * 3 + 1] = baseY * scaleY
                    posArray[j * 3 + 2] = z
                }

                positionAttribute.needsUpdate = true
                mesh.geometry.computeBoundingSphere()

                mesh.userData.hover = THREE.MathUtils.lerp(
                    mesh.userData.hover,
                    hoveredMesh === mesh ? 1 : 0,
                    10 * dt
                )

                const material = mesh.material as THREE.ShaderMaterial
                const brightness = 1.0 + mesh.userData.hover * 0.15
                material.uniforms.uBrightness.value = brightness

                const parallaxAmount = Math.max(
                    -1.2,
                    Math.min(1.2, uOffset / L)
                )
                material.uniforms.uParallax.value = parallaxAmount
            })

            renderer.render(scene, camera)
            animationFrameId = requestAnimationFrame(tick)
        }
        tick()

        return () => {
            container.removeEventListener("wheel", onWheel)
            container.removeEventListener("pointerdown", onPointerDown)
            container.removeEventListener("pointermove", onPointerMove)
            container.removeEventListener("pointerup", onPointerUp)
            container.removeEventListener("pointercancel", onPointerUp)
            container.removeEventListener("click", onClick)
            resizeObserver.disconnect()
            cancelAnimationFrame(animationFrameId)

            if (renderer.domElement.parentNode === container) {
                container.removeChild(renderer.domElement)
            }

            baseGeometry.dispose()
            meshes.forEach((m) => {
                m.geometry.dispose()
                ;(m.material as THREE.Material).dispose()
            })
            renderer.dispose()
        }
    }, [
        images,
        cardWidth,
        cardHeight,
        gap,
        cylinderRadius,
        arcLength,
        backgroundColor,
    ])

    return (
        <div
            style={{
                ...style,
                position: "relative",
                width: "100%",
                height: "100%",
                overflow: "hidden",
                backgroundColor: backgroundColor,
                touchAction: "none",
            }}
        >
            <div
                ref={containerRef}
                style={{
                    width: "100%",
                    height: "100%",
                    cursor: "grab",
                    touchAction: "none",
                }}
            />
        </div>
    )
}

CinematicCarousel.defaultProps = {
    cardWidth: 4.5,
    cardHeight: 6.5,
    gap: 0.5,
    cylinderRadius: 9.0,
    arcLength: 5.0,
    backgroundColor: "#000000",
}

addPropertyControls(CinematicCarousel, {
    images: {
        type: ControlType.Array,
        control: {
            type: ControlType.Image,
        },
        title: "Images",
        description: "Upload images. Leave empty to use default placeholders.",
    },
    cardWidth: {
        type: ControlType.Number,
        title: "Card Width",
        defaultValue: CinematicCarousel.defaultProps.cardWidth,
        min: 1,
        max: 20,
        step: 0.1,
    },
    cardHeight: {
        type: ControlType.Number,
        title: "Card Height",
        defaultValue: CinematicCarousel.defaultProps.cardHeight,
        min: 1,
        max: 20,
        step: 0.1,
    },
    gap: {
        type: ControlType.Number,
        title: "Gap Space",
        defaultValue: CinematicCarousel.defaultProps.gap,
        min: 0,
        max: 10,
        step: 0.1,
    },
    cylinderRadius: {
        type: ControlType.Number,
        title: "Curve Radius",
        defaultValue: CinematicCarousel.defaultProps.cylinderRadius,
        min: 2,
        max: 30,
        step: 0.5,
    },
    arcLength: {
        type: ControlType.Number,
        title: "Arc Length",
        defaultValue: CinematicCarousel.defaultProps.arcLength,
        min: 1,
        max: 20,
        step: 0.5,
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: CinematicCarousel.defaultProps.backgroundColor,
    },
})
