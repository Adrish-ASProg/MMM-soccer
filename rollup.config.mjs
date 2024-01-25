import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";

export default [
    {
        input: "./src/MMM-soccer.ts",
        plugins: [
            typescript(),
            resolve(),
            commonjs()
        ],
        output: {
            file: "./MMM-soccer.js",
            format: "iife"
        }
    }, {
        input: "./src/node_helper.ts",
        plugins: [
            typescript()
        ],
        output: {
            file: "./node_helper.js",
            format: "umd"
        }
    }
];
