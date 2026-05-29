const challenges = new Map<string, string>();

export const challengeStore = {
  set(username: string, challenge: string) {
    challenges.set(username, challenge);
  },
  get(username: string): string | undefined {
    return challenges.get(username);
  },
  delete(username: string) {
    challenges.delete(username);
  },
};
