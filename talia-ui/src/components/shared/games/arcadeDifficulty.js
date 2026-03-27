/** Standard arcade difficulty; stored on each game model as `difficulty`. */

export const ARCADE_DIFFICULTY_EASY = 'easy';
export const ARCADE_DIFFICULTY_NORMAL = 'normal';

export const ARCADE_DIFFICULTIES = [ARCADE_DIFFICULTY_EASY, ARCADE_DIFFICULTY_NORMAL];

export function isArcadeEasy(model) {
  return model?.difficulty === ARCADE_DIFFICULTY_EASY;
}
