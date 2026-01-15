/**
 * Mock for uuid package
 */

let counter = 0;

export const v4 = () => {
  counter++;
  return `mock-uuid-${counter}`;
};

export const v1 = () => {
  counter++;
  return `mock-uuid-v1-${counter}`;
};

export default { v4, v1 };

