import { useCallback } from 'react';
import {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming
} from 'react-native-reanimated';

// A red pulse around the camera frame, for the moments a scan is refused: a barcode that is not a
// book, or one taken back out of the queue. The camera fills the screen and you are holding a book
// up with the other hand, so a line of hint text alone is easy to miss.
//
// Deliberately not Colors.danger. That red is chosen to sit on paper at small sizes; over a live
// camera feed it reads as brown. This one is picked to stay legible against whatever the lens
// happens to be pointing at.
const FLASH = '#FF453A';
const RESTING = '#FFFFFF';

const IN_MS = 110;
const OUT_MS = 420;

export function useRedFlash() {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  // `times` for the cases that should read as a warning rather than a blip. Two pulses say "stop"
  // where one says "noted"; more than a few would be a strobe.
  const flash = useCallback((times = 1) => {
    const count = Math.max(1, Math.min(4, Math.round(times)));
    const pulses: number[] = [];

    for (let i = 0; i < count; i += 1) {
      if (reduceMotion) {
        // Still appears and still clears: only the fade goes. This is feedback, not decoration,
        // so removing it entirely would take away the signal rather than the animation.
        pulses.push(withTiming(1, { duration: 0 }), withDelay(OUT_MS, withTiming(0, { duration: 0 })));
      } else {
        pulses.push(withTiming(1, { duration: IN_MS }), withTiming(0, { duration: OUT_MS }));
      }
    }

    progress.set(withSequence(...pulses));
  }, [progress, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    borderColor: interpolateColor(progress.get(), [0, 1], [RESTING, FLASH])
  }));

  // The same pulse applied to text, so a title can flash with the frame instead of the two
  // drifting apart with their own timings.
  const textStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.get(), [0, 1], [RESTING, FLASH])
  }));

  return { flash, style, textStyle };
}
