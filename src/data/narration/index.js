// Registry of narration scripts. Adding a level's narration = add its file and one entry here.
// Static imports (not dynamic import()) so a level without a script doesn't cause a 404.
import common from './common.js';
import test from './test.js';
import sandbox from './sandbox.js';
import bedroom from './bedroom.js';

export const COMMON_SCRIPT = common;

export const LEVEL_SCRIPTS = {
    test,
    sandbox,
    bedroom,
};
