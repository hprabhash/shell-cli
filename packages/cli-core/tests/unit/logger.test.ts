import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { Logger } from "../../src/core/logger";

describe("Logger", () => {
  let logSpy: MockInstance;
  let warnSpy: MockInstance;
  let errorSpy: MockInstance;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("suppresses info/success/warn in silent mode but still prints errors", () => {
    const logger = new Logger();
    logger.configure({ level: "silent" });
    logger.info("info");
    logger.success("success");
    logger.warn("warn");
    logger.error("error");

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("shows normal-level messages by default but not verbose/debug", () => {
    const logger = new Logger();
    logger.info("info message");
    logger.verbose("verbose message");
    logger.debug("debug message");

    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it("shows verbose messages once configured", () => {
    const logger = new Logger();
    logger.configure({ level: "verbose" });
    logger.verbose("verbose message");

    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it("only shows debug messages at the debug level", () => {
    const logger = new Logger();
    logger.configure({ level: "verbose" });
    logger.debug("debug message");
    expect(logSpy).not.toHaveBeenCalled();

    logger.configure({ level: "debug" });
    logger.debug("debug message");
    expect(logSpy).toHaveBeenCalledTimes(1);
  });
});
