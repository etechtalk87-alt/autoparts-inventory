const fs = require('fs');
const readline = require('readline');
const path = require('path');

const logPath = path.join('C:', 'Users', 'DELL', '.gemini', 'antigravity-ide', 'brain', '426a8b15-60d9-449c-9f21-4aeca4812b6b', '.system_generated', 'logs', 'transcript_full.jsonl');

async function recover() {
    const fileStream = fs.createReadStream(logPath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let part1 = '';
    let part2 = '';

    for await (const line of rl) {
        try {
            const entry = JSON.parse(line);
            if (entry.type === 'PLANNER_RESPONSE' && entry.tool_calls) {
               // nothing here, it's the response
            } else if (entry.type === 'TOOL_RESPONSE' && entry.content) {
                if (entry.content.includes('Showing lines 1 to 800')) {
                    part1 = entry.content;
                }
                if (entry.content.includes('Showing lines 800 to 1026')) {
                    part2 = entry.content;
                }
            }
        } catch (e) {
            // ignore
        }
    }
    
    fs.writeFileSync('recover_part1.txt', part1);
    fs.writeFileSync('recover_part2.txt', part2);
    console.log("Extracted parts.");
}

recover();
