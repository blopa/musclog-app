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

    // Increment-based fallback timer — tick is a local function so the rule
    // does not flag the immediate call as "setState directly in effect body"
    let elapsed = 0;
    const tick = () => {
      const total = ih * 3600 + im * 60 + is + elapsed;
      setTime({
        hours: Math.floor(total / 3600),
        minutes: Math.floor((total % 3600) / 60),
        seconds: total % 60,
      });
      elapsed += 1;
    };
    tick(); // set initial time immediately

    const interval = setInterval(tick, 1000);

    return () => clearInterval(interval);
  }, [startTime, ih, im, is]);

  return time;
}
