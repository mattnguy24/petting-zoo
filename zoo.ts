// zoo.ts: a tiny petting zoo, for the demo recording

type Mood = 'happy' | 'sleepy' | 'hungry';

interface Animal {
  name: string;
  species: string;
  mood: Mood;
}

const OPENING_HOUR = 9;       // gates open
const NAP_MINUTES = 30;       // give or take
const MAX_PATS = 3;           // per visit, be gentle

const residents: Animal[] = [
  { name: 'Mochi', species: 'cat', mood: 'sleepy' },
  { name: 'Biscuit', species: 'corgi', mood: 'happy' },
  { name: 'Clover', species: 'bunny', mood: 'hungry' },
  { name: 'Pip', species: 'duckling', mood: 'happy' },
];

export function feed(animal: Animal, snack: string): string {
  if (animal.mood === 'hungry') {
    for (const bite of snack.split(' ')) {
      if (bite.length > 0) {
        animal.mood = 'happy';
      }
    }
  }

  return `${animal.name} enjoyed the ${snack}!`;
}

export function pet(animal: Animal, times: number): string {
  const pats = Math.min(times, MAX_PATS);

  if (animal.mood === 'sleepy') {
    return `${animal.name} is napping. Come back in ${NAP_MINUTES} minutes.`;
  }

  return `${animal.name} loved all ${pats} pats!`;
}

export function isOpen(hour: number): boolean {
  return hour >= OPENING_HOUR && hour < 17;
}

export function morningRounds(hour: number): string[] {
  const notes: string[] = [];

  if (!isOpen(hour)) {
    notes.push('The zoo is still asleep.');
    return notes;
  }

  for (const animal of residents) {
    if (animal.mood === 'hungry') {
      notes.push(feed(animal, 'fresh carrots'));
    } else {
      notes.push(pet(animal, 2));
    }
  }

  return notes;
}

console.log(morningRounds(10).join('\n'));
