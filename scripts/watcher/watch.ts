import Joi from "joi";
import path from "path";

import ChokidarWatcher from "./ChokidarWatcher";
import { Config, configSchema, WatchConfig, Watcher } from "./types";

// Polyfill the asyncIterator symbol.
if (Symbol.asyncIterator === undefined) {
  (Symbol as any).asyncIterator = Symbol.for("asyncIterator");
}

async function beginWatch(watcher: Watcher, key: string, config: WatchConfig) {
  const { paths, ignore, executor } = config;
  if (executor.onInit) {
    executor.onInit();
  }
  for await (const filePath of watcher.watch(paths, { ignore })) {
    // tslint:disable-next-line:no-console
    console.log(`Execute "${key}"`);
    executor.execute(filePath);
  }
}

function prependRootDir(prepend: string, cfg: WatchConfig): WatchConfig {
  const prependFunc = (p: string) => path.resolve(prepend, p);
  return {
    ...cfg,
    paths: cfg.paths.map(prependFunc),
    ignore: cfg.ignore ? cfg.ignore.map(prependFunc) : undefined,
  };
}

function setupCleanup(config: Config) {
  ["SIGINT", "SIGTERM"].forEach(signal =>
    process.once(signal as any, () => {
      for (const key of Object.keys(config.watchers)) {
        if (config.watchers[key].executor.onCleanup) {
          config.watchers[key].executor.onCleanup!();
        }
      }
      process.exit(0);
    })
  );
}

export default async function watch(config: Config) {
  Joi.assert(config, configSchema);
  const watcher = config.backend || new ChokidarWatcher();
  setupCleanup(config);
  for (const key of Object.keys(config.watchers)) {
    // tslint:disable-next-line:no-console
    console.log(`Start watcher "${key}"`);
    const watcherConfig = config.rootDir
      ? prependRootDir(config.rootDir, config.watchers[key])
      : config.watchers[key];
    beginWatch(watcher, key, watcherConfig);
  }
}