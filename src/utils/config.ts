import { AnyConfig } from "../model/crann.model";

export function createConfig<T extends AnyConfig>(config: T): T {
  return config;
}
