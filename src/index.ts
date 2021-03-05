import { BuilderContext, BuilderOutput, createBuilder } from '@angular-devkit/architect';
import { experimental, normalize, Path, schema, json, getSystemPath, join, resolve } from '@angular-devkit/core';
import { NodeJsSyncHost } from '@angular-devkit/core/node';
import { run } from 'jest';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { OptionsConverter } from './options-converter';
import { SchemaObject as JestBuilderSchema } from './schema';

export async function getRoots(
  context: BuilderContext
): Promise<{ workspaceRoot: Path; projectRoot: Path }> {
  const host = new NodeJsSyncHost();
  const registry = new schema.CoreSchemaRegistry();
  registry.addPostTransform(schema.transforms.addUndefinedDefaults);
  const workspace = await experimental.workspace.Workspace.fromPath(
    host,
    normalize(context.workspaceRoot),
    registry
  );
  const projectName = context.target ? context.target.project : workspace.getDefaultProjectName();

  if (!projectName) {
    throw new Error('Must either have a target from the context or a default project.');
  }

  const { root } = workspace.getProject(projectName);

  return {
    projectRoot: normalize(root),
    workspaceRoot: workspace.root,
  };
}

export function runJest(
  options: JestBuilderSchema,
  context: BuilderContext
): Observable<BuilderOutput> {
  async function buildArgv(): Promise<string[]> {
    const optionsConverter = new OptionsConverter();

    const { workspaceRoot, projectRoot } = await getRoots(context);

    const pathToProject: Path = resolve(workspaceRoot, projectRoot);
    const configuration = require(getSystemPath(join(pathToProject, options.configPath)));

    delete options.configPath;
    const argv = optionsConverter.convertToCliArgs(options);

    argv.push('--config', JSON.stringify(configuration));
    return argv;
  }
  async function runJestCLI() {
    const argv = await buildArgv();
    return run(argv);
  }

  return from(runJestCLI()).pipe(map(() => ({ success: true })));
}

export default createBuilder<JestBuilderSchema & json.JsonObject>(runJest);
