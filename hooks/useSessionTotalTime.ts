import { useEffect, useState } from 'react';

import { isStaticExport } from '@/constants/platform';

type Time = {
  hours: number;
  minutes: number;
  seconds: number;
};

type UseSessionTotalTimeProps = {
  startTime?: number;
  initialTime?: Time;
};

const DEFAULT_INITIAL_TIME: Time = { hours: 0, minutes: 0, seconds: 0 };

export function useSessionTotalTime({
  startTime,
  initialTime = DEFAULT_INITIAL_TIME,
}: UseSessionTotalTimeProps) {
  const [time, setTime] = useState(initialTime);

  const ih = initialTime.hours;
  const im = initialTime.minutes;
  const is = initialTime.seconds;

  useEffect(() => {
    if (isStaticExport) {
      return;
    }

    if (startTime != null) {
      const updateTime = () => {
        const now = Date.now();
        const elapsedMs = now - startTime;
        const totalSeconds = Math.floor(elapsedMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        setTime((prev) =>
          prev.hours === hours && prev.minutes === minutes && prev.seconds === seconds
            ? prev
            : { hours, minutes, seconds }
        );
      };

      // Update immediately
      updateTime();

      // Then update every second
      const interval = setInterval(updateTime, 1000);
      return () => clearInterval(interval);
    }

    setTime({ hours: ih, minutes: im, seconds: is });

    // Fallback to incrementing timer if no startTime provided
    const interval = setInterval(() => {
      setTime((prev) => {
        let newSeconds = prev.seconds + 1;
        let newMinutes = prev.minutes;
        let newHours = prev.hours;

        if (newSeconds >= 60) {
          newSeconds = 0;
          newMinutes += 1;
        }
        if (newMinutes >= 60) {
          newMinutes = 0;
          newHours += 1;
        }

        return { hours: newHours, minutes: newMinutes, seconds: newSeconds };
      });
    }, 1000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startTime, ih, im, is]);

  return time;
}
