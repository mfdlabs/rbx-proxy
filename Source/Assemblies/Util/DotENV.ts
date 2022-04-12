import { __baseDirName } from 'Assemblies/Directories';
import { parse } from 'dotenv';
import { readFileSync } from 'fs';

export class DotENV {
    public static GlobalConfigure() {
        try {
            const data = parse(readFileSync(__baseDirName + '/.env'));

            for (const k in data) {
                process.env[k] = data[k];
            }
        } catch (e) {}
    }
}
