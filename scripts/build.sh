#!/bin/bash

rm -rf $PWD/dist
npx babel src --extensions ".ts" --out-dir dist --ignore '**/*.unit.ts' --source-maps inline
git reset
git add $PWD/dist
git commit -m 'Updating dist files' -n
