import { useEffect, useState } from 'react';

type Time = {
  hours: number;
  minutes: number;
  seconds: number;
};

type UseSessionTotalTimeProps = {
  startTime?: number;
  initialTime?: Time;
};

export function useSessionTotalTime({
  startTime,
  initialTime = { hours: 0, minutes: 0, seconds: 0 },
}: UseSessionTotalTimeProps) {
  const [time, setTime] = useState(initialTime);

  useEffect(() => {
    if (startTime) {
      const updateTime = () => {
        const now = Date.now();
        const elapsedMs = now - startTime;
        const totalSeconds = Math.floor(elapsedMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        setTime({ hours, minutes, seconds });
      };

      // Update immediately
      updateTime();

      // Then update every second
      const interval = setInterval(updateTime, 1000);
      return () => clearInterval(interval);
    } else {
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
    }
  }, [startTime]);

  return time;
}
