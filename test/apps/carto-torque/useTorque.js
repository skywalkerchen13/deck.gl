import { CartoLayer } from "@deck.gl/carto";
import { useCallback, useEffect, useState } from "react";

const SECOND = 1000
/**
 * 
 * @param {*} cartoLayerProps 
 * @param {*} updateTriggers 
 * @param {
 *          steps,
 *          secondsByStep
 *        } opts 
 * @returns 
 */
export default function useTorque(cartoLayerProps, updateTriggers, opts = { secondsByStep: 1, steps: 10 }) {
  const [progress, setProgress] = useState(0)
  const [playing, setPlaying] = useState(true)

  const createLayer = () => {
    const functionsToOverride = Object.entries(cartoLayerProps).filter(([_, value]) => typeof value === 'function')
    const enhancedLayerProps = {
      ...cartoLayerProps,
      ...(functionsToOverride.reduce((acum, [key, callback]) => {
        acum[key] = (d) => callback(d, progress)
        return acum
      }, {})),
      updateTriggers: {
        ...(updateTriggers?.reduce((ut, property) => {
          ut[property] = progress
          return ut
        }, {}))
      }
    }

    return new CartoLayer(enhancedLayerProps)
  }

  const layer = createLayer()

  useEffect(() => {
    const animationTimer = setInterval(() => {
      if (!playing) return

      setProgress((prevProgress) => {
        const newProgress = prevProgress + 1;
        return newProgress > opts.steps ? 0 : newProgress;
      });
    }, opts.secondsByStep*SECOND);

    return () => {
      clearInterval(animationTimer)
    }
  }, [playing])

  const pauseOrResume = () => {
    setPlaying(!playing)
  }

  return { playing, pauseOrResume, layer, progress, setProgress }
}