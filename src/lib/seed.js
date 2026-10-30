// Sample students for the demo. Made-up people only (problem statement rule).
// free: one row per block (morning, afternoon, evening, night), one flag per day Mon..Sun.
export const PEOPLE = [
  {
    id: 'meera', name: 'Meera S.', quote: 'show me the layout, i will show you the grid',
    langs: ['English', 'Hindi'], cost: 8, shape: 'sphere',
    skills: [['Figma', 4], ['CSS', 3], ['React', 2]],
    free: [[0, 0, 0, 0, 0, 1, 1], [0, 1, 0, 1, 0, 1, 0], [1, 1, 1, 0, 1, 0, 0], [0, 0, 0, 0, 0, 0, 0]],
  },
  {
    id: 'arjun', name: 'Arjun K.', quote: 'send me the broken shader, not a screenshot',
    langs: ['English', 'Hindi', 'Gujarati'], cost: 10, shape: 'torus',
    skills: [['GLSL', 5], ['Three.js', 4], ['WebGL', 4], ['Blender', 2]],
    free: [[0, 0, 0, 0, 0, 1, 1], [0, 0, 1, 0, 0, 1, 0], [1, 0, 1, 1, 0, 0, 0], [1, 1, 0, 1, 1, 0, 0]],
  },
  {
    id: 'kabir', name: 'Kabir R.', quote: 'paste the query and the error, in that order',
    langs: ['English', 'Marathi'], cost: 10, shape: 'sphere',
    skills: [['SQL', 5], ['Postgres', 4], ['Schema design', 4]],
    free: [[0, 0, 0, 0, 0, 0, 1], [0, 0, 0, 0, 0, 1, 1], [1, 1, 1, 1, 1, 0, 0], [0, 0, 0, 0, 0, 0, 0]],
  },
  {
    id: 'tanvi', name: 'Tanvi P.', quote: 'the borrow checker is right, it is just rude about it',
    langs: ['English', 'Hindi', 'Marathi'], cost: 8, shape: 'rose',
    skills: [['Rust', 4], ['Borrow checker', 4], ['WebAssembly', 3]],
    free: [[0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 1, 0], [0, 0, 0, 1, 0, 0, 0], [1, 0, 1, 1, 0, 0, 1]],
  },
  {
    id: 'dev', name: 'Dev M.', quote: 'if it renders twice, it is probably you, not react',
    langs: ['English', 'Hindi'], cost: 12, shape: 'waves',
    skills: [['React', 5], ['useEffect', 5], ['Next.js', 4]],
    free: [[1, 0, 1, 0, 1, 0, 0], [1, 1, 1, 1, 1, 0, 0], [0, 0, 0, 0, 0, 1, 1], [0, 0, 0, 0, 0, 0, 0]],
  },
  {
    id: 'ishaan', name: 'Ishaan V.', quote: 'plot it first, then we argue',
    langs: ['English', 'Tamil'], cost: 6, shape: 'sphere',
    skills: [['Python', 3], ['Pandas', 3], ['Matplotlib', 2]],
    free: [[1, 1, 1, 1, 1, 1, 1], [1, 1, 0, 1, 1, 0, 0], [0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0]],
  },
  {
    id: 'riya', name: 'Riya D.', quote: 'name your layers and half the bugs leave',
    langs: ['English', 'Hindi'], cost: 8, shape: 'rose',
    skills: [['Design systems', 4], ['Figma', 4], ['CSS', 4]],
    free: [[0, 0, 0, 0, 0, 1, 0], [0, 0, 0, 0, 0, 1, 0], [0, 1, 0, 1, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0]],
  },
  {
    id: 'sahil', name: 'Sahil N.', quote: 'it works on my machine, so we ship my machine',
    langs: ['English', 'Marathi'], cost: 10, shape: 'torus',
    skills: [['Docker', 4], ['Linux', 4], ['Git', 5]],
    free: [[0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 1, 1], [1, 1, 1, 1, 1, 1, 1]],
  },
  {
    id: 'nisha', name: 'Nisha T.', quote: 'ease in, ease out, never linear',
    langs: ['English', 'Tamil'], cost: 8, shape: 'waves',
    skills: [['WebGL', 3], ['Canvas', 4], ['p5.js', 4]],
    free: [[0, 0, 0, 0, 0, 1, 1], [0, 0, 0, 0, 1, 0, 0], [0, 0, 0, 0, 1, 0, 0], [0, 0, 0, 0, 0, 0, 0]],
  },
  {
    id: 'omar', name: 'Omar F.', quote: 'write the slow version first, then make it fast',
    langs: ['English', 'Hindi'], cost: 12, shape: 'sphere',
    skills: [['C++', 5], ['Algorithms', 5], ['Competitive coding', 4]],
    free: [[1, 1, 1, 1, 1, 1, 1], [0, 0, 0, 0, 0, 0, 0], [0, 1, 0, 1, 0, 1, 0], [0, 0, 0, 0, 0, 0, 0]],
  },
]

export const WELCOME_CREDITS = 30

// Past sessions, replayed through the real ledger functions on first load,
// so every balance on screen comes from rows the system actually wrote.
// [learner, mentor, skill, problem, days ago, outcome]
export const HISTORY = [
  ['ishaan', 'meera', 'Figma', 'auto layout keeps squashing my buttons', 16, 'done'],
  ['meera', 'kabir', 'SQL', 'my join returns every row twice', 13, 'done'],
  ['nisha', 'arjun', 'GLSL', 'my canvas renders black', 12, 'done'],
  ['dev', 'arjun', 'Three.js', 'shadows flicker when the camera moves', 11, 'done'],
  ['meera', 'tanvi', 'Rust', 'why does this need a lifetime', 6, 'declined'],
  ['riya', 'meera', 'CSS', 'grid items overflow on phones', 3, 'done'],
  ['omar', 'meera', 'Figma', 'prototype links go to the wrong frame', 2, 'done'],
  ['tanvi', 'dev', 'useEffect', 'fetch runs on every keystroke', 2, 'done'],
  ['kabir', 'sahil', 'Docker', 'container cannot reach postgres', 2, 'done'],
  ['nisha', 'meera', 'CSS', 'easing feels robotic', 1, 'done'],
  ['ishaan', 'omar', 'Algorithms', 'my recursion blows the stack', 1, 'done'],
]

// Open right now, so the demo starts with something to act on.
// [learner, mentor, skill, problem, minutes ago, state]
export const OPEN = [
  ['meera', 'arjun', 'React', 'useEffect fires twice and opens two sockets', 6, 'live'],
  ['omar', 'meera', 'Figma', 'components detach when i resize the frame', 6, 'requested'],
  ['kabir', 'arjun', 'WebGL', 'my texture shows up upside down', 3, 'requested'],
]

// Code each room starts with, keyed by skill.
export const STARTER_CODE = {
  React: `import { useEffect, useState } from 'react';
import { connect } from './socket';

export function Room({ roomId }) {
  const [doc, setDoc] = useState('');

  useEffect(() => {
    const socket = connect(roomId);
    socket.on('edit', setDoc);
  }, [roomId]);

  return <Editor value={doc} />;
}
`,
  default: `// paste the code you are stuck on here.
// both of you can type at the same time.
`,
}
