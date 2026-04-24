import React, { ComponentType } from "react"

/**
 * HIDE SCROLLBAR OVERRIDE (Safari + iOS Optimized)
 * Apply this to any Frame or Stack that has "Overflow: Scroll"
 */
export function withHiddenScrollbar(Component: ComponentType): ComponentType {
    return (props: any) => {
        return (
            <>
                <style
                    dangerouslySetInnerHTML={{
                        __html: `
                    /* Targeted fix for Chrome, Safari, and iOS */
                    .no-scrollbar::-webkit-scrollbar {
                        display: none !important;
                        width: 0 !important;
                        height: 0 !important;
                        background: transparent !important;
                        -webkit-appearance: none !important;
                    }
                `,
                    }}
                />

                <Component
                    {...props}
                    className={`${props.className || ""} no-scrollbar`}
                    style={{
                        ...props.style,
                        scrollbarWidth: "none", // Firefox
                        msOverflowStyle: "none", // IE/Edge
                        // Safari/iOS specific: ensures smooth momentum scrolling
                        WebkitOverflowScrolling: "touch",
                    }}
                />
            </>
        )
    }
}
