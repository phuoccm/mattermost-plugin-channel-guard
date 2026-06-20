// Build the webapp bundle for the Channel Guard plugin.
//
// React is provided by the Mattermost host at runtime via window.React and
// window.ReactDOM, so we externalise both packages and shim require() at the
// start of the IIFE to return those globals. We use classic JSX transform
// (React.createElement) so we do NOT need react/jsx-runtime to be available.

import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';

mkdirSync('dist', {recursive: true});

// JSX strategy:
//   tsconfig.json keeps "jsx": "preserve" so TypeScript leaves JSX alone
//   for esbuild to transform. esbuild uses the automatic React 17+ runtime
//   ("automatic"), which emits imports from "react/jsx-runtime". Both
//   "react" and "react/jsx-runtime" are externalised so the bundle does
//   not ship its own React copy — they are resolved at load time to the
//   host-provided window.React via the require() shim below.
await build({
    entryPoints: ['src/index.tsx'],
    outfile: 'dist/main.js',
    bundle: true,
    format: 'iife',
    target: ['es2020'],
    platform: 'browser',
    minify: true,
    sourcemap: false,
    jsx: 'automatic',
    jsxImportSource: 'react',
    loader: {'.ts': 'ts', '.tsx': 'tsx'},
    external: ['react', 'react-dom', 'react/jsx-runtime'],
    banner: {
        // jsx-runtime signature is (type, props, key). React.createElement's
        // third positional argument is a CHILD, not a key — passing the key
        // directly there silently drops children. Splice the key into config
        // and call createElement with no rest args so it falls back to
        // props.children.
        js: [
            'var require = (id) => {',
            '  if (id === "react") return window.React;',
            '  if (id === "react-dom") return window.ReactDOM;',
            '  if (id === "react/jsx-runtime") {',
            '    var R = window.React;',
            '    var jsx = function (type, props, key) {',
            '      var cfg = key === undefined ? props : Object.assign({key: key}, props);',
            '      return R.createElement(type, cfg);',
            '    };',
            '    return { jsx: jsx, jsxs: jsx, Fragment: R.Fragment };',
            '  }',
            '  throw new Error("channel-guard: unknown external " + id);',
            '};',
        ].join(''),
    },
    logLevel: 'info',
});

console.log('webapp built: dist/main.js');
