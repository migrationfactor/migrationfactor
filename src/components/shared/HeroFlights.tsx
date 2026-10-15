'use client';

import { useEffect, useRef } from 'react';

type Flight = { plane: { src: string; x: number; y: number; width: number; height: number }; path: string; dots: string };

// Geometry traced from the approved heroFlights.webp (800 × 180). Each path ends at its
// plane's centre, so the finished animation matches the original artwork exactly.
const flights: Flight[] = [
  {
    plane: { src: '/media/heroPlaneA.webp', x: 263, y: 96, width: 67, height: 51 },
    path: 'M1.5 174.8C77.6 99.4 198.9 75.8 296.2 122.5',
    dots: '1.5 174.8,8.5 168.6,16.2 162.2,24.1 155.8,32.2 149.7,40.8 143.8,49.2 138.4,57.9 133.1,66.8 128.3,75.7 123.6,85 119.5,94.3 115.4,103.9 111.9,113.8 108.8,123.1 106.1,132.9 103.9,142.9 101.9,153.1 100.2,163.1 99.2,173.1 98.9,183.3 98.4,193.5 98.9,203.7 99.1,213.7 100.1,223.8 101.3,233.7 103.1,243.7 105.1,253.7 107.4,263.1 109.9',
  },
  {
    plane: { src: '/media/heroPlaneB.webp', x: 306, y: 0, width: 70, height: 52 },
    path: 'M600.8 177.6C555 80.6 449.7 15.3 341.7 25.5',
    dots: '600.8 177.6,596 169,591.1 160.1,585.7 151.6,580 143,574.4 134.8,568.4 126.7,562 118.5,554.8 111.3,548.4 103.3,541.1 96.1,533.8 89.2,526 82.5,518 76.5,509.8 70.4,501.2 64.6,492.7 59.4,483.9 54.6,474.9 50.3,465.6 46.1,456.1 42.1,446.3 38.9,437 36,426.9 33.2,417.1 30.9,407.1 28.9,397.1 27.3,387 26,377 25',
  },
  {
    plane: { src: '/media/heroPlaneC.webp', x: 732, y: 89, width: 68, height: 50 },
    path: 'M471.2 167.5C547.3 91.7 668.8 68.6 766.4 115',
    dots: '471.2 167.5,478.5 161,486 154.5,494.2 148.4,502.2 142.2,510.8 136.3,519.1 130.9,527.9 125.5,536.7 120.6,545.9 116.1,554.8 111.3,564.1 107.9,573.9 104.4,583.3 101.4,593.1 98.5,603.1 96.2,613.1 94.3,623 93,633 92,643.1 91.1,653.3 90.9,663.5 91,673.5 91.9,683.6 92.7,693.5 94,703.5 95.4,713.5 97.6,723.3 99.9,733.1 102.6',
  },
];

const delay = 350;
const duration = 2600;
const stagger = 450;
// The last dot sits behind the plane's tail, 89% of the way along each path.
const lastDot = 0.89;
/** The original dots are short dashes aligned with their route. */
function dashes(dots: string) {
  const points = dots.split(',').map((dot) => dot.split(' ').map(Number));
  return points.map(([cx, cy], index) => {
    const [px, py] = points[Math.max(index - 1, 0)];
    const [nx, ny] = points[Math.min(index + 1, points.length - 1)];
    return { cx, cy, angle: Math.round(Math.atan2(ny - py, nx - px) * 180 / Math.PI) };
  });
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Fly the three hero planes along their dotted routes whenever the homepage opens. */
export default function HeroFlights() {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const groups = Array.from(svg.querySelectorAll<SVGGElement>('.flight'));
    let frame = 0;

    const finish = () => {
      cancelAnimationFrame(frame);
      groups.forEach((group) => {
        group.querySelector('.flight-plane')?.removeAttribute('transform');
        group.querySelectorAll<SVGElement>('.flight-plane, .flight-dot').forEach((el) => el.style.removeProperty('opacity'));
      });
      svg.classList.add('is-done');
    };
    if (preference.matches) { finish(); return; }

    const tracks = groups.map((group) => {
      const route = group.querySelector<SVGPathElement>('.flight-route')!;
      const length = route.getTotalLength();
      const end = route.getPointAtLength(length);
      const before = route.getPointAtLength(length - 1);
      return {
        route, length, end,
        endAngle: Math.atan2(end.y - before.y, end.x - before.x),
        plane: group.querySelector<SVGGElement>('.flight-plane')!,
        dots: Array.from(group.querySelectorAll<SVGCircleElement>('.flight-dot')),
      };
    });
    const started = performance.now() + delay;

    const tick = (now: number) => {
      let running = false;
      tracks.forEach((track, index) => {
        const linear = Math.min(Math.max((now - started - index * stagger) / duration, 0), 1);
        if (linear < 1) running = true;
        const progress = ease(linear);
        const distance = track.length * progress;
        const point = track.route.getPointAtLength(distance);
        const behind = track.route.getPointAtLength(Math.max(distance - 1, 0));
        const ahead = distance < 1 ? track.route.getPointAtLength(1) : point;
        const angle = Math.atan2(ahead.y - behind.y, ahead.x - behind.x) - track.endAngle;
        track.plane.setAttribute('transform',
          `translate(${point.x - track.end.x} ${point.y - track.end.y}) rotate(${angle * 180 / Math.PI} ${track.end.x} ${track.end.y})`);
        track.plane.style.opacity = String(Math.min(linear * 8, 1));
        const visible = progress / lastDot * (track.dots.length - 1);
        track.dots.forEach((dot, dotIndex) => { if (dotIndex <= visible) dot.style.opacity = '1'; });
      });
      if (running) frame = requestAnimationFrame(tick);
      else finish();
    };
    frame = requestAnimationFrame(tick);

    preference.addEventListener('change', finish);
    return () => {
      cancelAnimationFrame(frame);
      preference.removeEventListener('change', finish);
    };
  }, []);

  return (
    <svg ref={ref} className="hero-flights" viewBox="0 0 800 180" width={800} height={180} aria-hidden="true" focusable="false">
      {flights.map(({ plane, path, dots }) => (
        <g className="flight" key={plane.src}>
          <path className="flight-route" d={path} />
          {dashes(dots).map(({ cx, cy, angle }) => (
            <ellipse className="flight-dot" key={`${cx} ${cy}`} cx={cx} cy={cy} rx={2.6} ry={1.4}
              transform={`rotate(${angle} ${cx} ${cy})`} />
          ))}
          <g className="flight-plane">
            <image href={plane.src} x={plane.x} y={plane.y} width={plane.width} height={plane.height} />
          </g>
        </g>
      ))}
    </svg>
  );
}
