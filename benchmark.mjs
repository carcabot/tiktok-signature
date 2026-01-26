#!/usr/bin/env node
/**
 * TikTok Signature Server - Benchmark Tool
 *
 * Tests signature generation throughput and latency.
 *
 * Usage:
 *   node benchmark.mjs [options]
 *
 * Options:
 *   --requests=N     Total requests to make (default: 100)
 *   --concurrency=N  Concurrent requests (default: 1)
 *   --endpoint=TYPE  Test endpoint: 'signature' or 'fetch' (default: signature)
 *   --host=URL       Server URL (default: http://localhost:8787)
 */

const TEST_URL = 'https://www.tiktok.com/api/post/item_list/?WebIdLastTime=1751010088&aid=1988&app_language=en-GB&app_name=tiktok_web&browser_language=en-GB&browser_name=Mozilla&browser_online=true&browser_platform=MacIntel&browser_version=5.0%20%28Macintosh%3B%20Intel%20Mac%20OS%20X%2010_15_7%29%20AppleWebKit%2F605.1.15%20%28KHTML%2C%20like%20Gecko%29%20Version%2F18.6%20Safari%2F605.1.15&channel=tiktok_web&cookie_enabled=true&count=5&coverFormat=0&cursor=0&data_collection_enabled=true&device_id=7520531026079925774&device_platform=web_pc&focus_state=true&history_len=2&is_fullscreen=false&is_page_visible=true&language=en-GB&odinId=7185858543857140779&os=mac&priority_region=US&region=US&screen_height=1117&screen_width=1728&secUid=MS4wLjABAAAAtBazTpLuo5XSFwEiX3gkaeV4ZY7u071I08MUNFL5B_zZoelUkTWrhCVvxK7LqAkr&tz_name=America%2FNew_York&user_is_login=false&video_encoding=mp4&webcast_language=en-GB';

// Parse command line arguments
function parseArgs() {
    const args = {
        requests: 100,
        concurrency: 1,
        endpoint: 'signature',
        host: 'http://localhost:8080'
    };

    for (const arg of process.argv.slice(2)) {
        if (arg.startsWith('--requests=')) {
            args.requests = parseInt(arg.split('=')[1], 10);
        } else if (arg.startsWith('--concurrency=')) {
            args.concurrency = parseInt(arg.split('=')[1], 10);
        } else if (arg.startsWith('--endpoint=')) {
            args.endpoint = arg.split('=')[1];
        } else if (arg.startsWith('--host=')) {
            args.host = arg.split('=')[1];
        } else if (arg === '--help' || arg === '-h') {
            console.log(`
TikTok Signature Server - Benchmark Tool

Usage: node benchmark.mjs [options]

Options:
  --requests=N     Total requests to make (default: 100)
  --concurrency=N  Concurrent requests (default: 1)
  --endpoint=TYPE  Test endpoint: 'signature' or 'fetch' (default: signature)
  --host=URL       Server URL (default: http://localhost:8787)

Examples:
  node benchmark.mjs --requests=50 --concurrency=1
  node benchmark.mjs --requests=100 --concurrency=5 --endpoint=fetch
`);
            process.exit(0);
        }
    }

    return args;
}

// Make a single request
async function makeRequest(host, endpoint) {
    const start = Date.now();
    const url = `${host}/${endpoint}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: TEST_URL })
        });

        const data = await response.json();
        const duration = Date.now() - start;

        if (data.status === 'ok') {
            if (endpoint === 'signature') {
                const xBogus = data.data?.['x-bogus'] || '';
                const isValid = xBogus.startsWith('DFSz');
                return { success: isValid, duration, xBogus: xBogus.substring(0, 20) };
            }
            if (endpoint === 'fetch') {
                const hasData = data.data?.itemList?.length > 0;
                return { success: hasData, duration, items: data.data?.itemList?.length || 0 };
            }
        }

        return { success: false, duration, error: data.message || 'Unknown error' };
    } catch (e) {
        return { success: false, duration: Date.now() - start, error: e.message };
    }
}

// Run benchmark with specified concurrency
async function runBenchmark(args) {
    console.log('='.repeat(60));
    console.log('TikTok Signature Server - Benchmark');
    console.log('='.repeat(60));
    console.log(`Host:        ${args.host}`);
    console.log(`Endpoint:    /${args.endpoint}`);
    console.log(`Requests:    ${args.requests}`);
    console.log(`Concurrency: ${args.concurrency}`);
    console.log('='.repeat(60));
    console.log('');

    // Check server health first
    try {
        const healthResponse = await fetch(`${args.host}/health`);
        const health = await healthResponse.json();
        if (!health.ready) {
            console.log('ERROR: Server is not ready. Please wait for initialization.');
            process.exit(1);
        }
        console.log(`Server ready (init method: ${health.initMethod})`);
        console.log('');
    } catch (e) {
        console.log(`ERROR: Cannot connect to server at ${args.host}`);
        console.log(e.message);
        process.exit(1);
    }

    const results = [];
    const startTime = Date.now();
    let completed = 0;
    let successful = 0;
    let failed = 0;

    // Progress display
    const showProgress = () => {
        const pct = Math.round((completed / args.requests) * 100);
        const bar = '#'.repeat(Math.floor(pct / 5)) + '-'.repeat(20 - Math.floor(pct / 5));
        process.stdout.write(`\r[${bar}] ${pct}% (${completed}/${args.requests}) - ${successful} ok, ${failed} failed`);
    };

    console.log('Running benchmark...');
    console.log('');

    // Run requests with concurrency control
    let nextIndex = 0;

    const runNext = async () => {
        while (nextIndex < args.requests) {
            nextIndex++;
            const result = await makeRequest(args.host, args.endpoint);
            results.push(result);
            completed++;

            if (result.success) {
                successful++;
            } else {
                failed++;
            }

            showProgress();
        }
    };

    // Start concurrent workers
    const workers = [];
    for (let i = 0; i < args.concurrency; i++) {
        workers.push(runNext());
    }

    await Promise.all(workers);

    const totalTime = Date.now() - startTime;
    console.log('\n');

    // Calculate statistics
    const durations = results.map(r => r.duration);

    const stats = {
        total: results.length,
        successful,
        failed,
        successRate: ((successful / results.length) * 100).toFixed(1),
        totalTimeMs: totalTime,
        totalTimeSec: (totalTime / 1000).toFixed(2),
        requestsPerSecond: (results.length / (totalTime / 1000)).toFixed(2),
        requestsPerMinute: ((results.length / (totalTime / 1000)) * 60).toFixed(0),
        avgLatencyMs: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
        minLatencyMs: durations.length ? Math.min(...durations) : 0,
        maxLatencyMs: durations.length ? Math.max(...durations) : 0,
        p50LatencyMs: percentile(durations, 50),
        p95LatencyMs: percentile(durations, 95),
        p99LatencyMs: percentile(durations, 99)
    };

    // Display results
    console.log('='.repeat(60));
    console.log('RESULTS');
    console.log('='.repeat(60));
    console.log('');
    console.log('Throughput:');
    console.log(`  Total requests:     ${stats.total}`);
    console.log(`  Successful:         ${stats.successful} (${stats.successRate}%)`);
    console.log(`  Failed:             ${stats.failed}`);
    console.log(`  Total time:         ${stats.totalTimeSec}s`);
    console.log(`  Requests/second:    ${stats.requestsPerSecond}`);
    console.log(`  Requests/minute:    ${stats.requestsPerMinute}`);
    console.log('');
    console.log('Latency:');
    console.log(`  Average:            ${stats.avgLatencyMs}ms`);
    console.log(`  Min:                ${stats.minLatencyMs}ms`);
    console.log(`  Max:                ${stats.maxLatencyMs}ms`);
    console.log(`  P50 (median):       ${stats.p50LatencyMs}ms`);
    console.log(`  P95:                ${stats.p95LatencyMs}ms`);
    console.log(`  P99:                ${stats.p99LatencyMs}ms`);
    console.log('');

    // Show sample errors if any
    const errors = results.filter(r => !r.success && r.error);
    if (errors.length > 0) {
        console.log('Sample errors:');
        const uniqueErrors = [...new Set(errors.map(e => e.error))].slice(0, 5);
        uniqueErrors.forEach(e => console.log(`  - ${e}`));
        console.log('');
    }

    console.log('='.repeat(60));

    return stats;
}

function percentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
}

// Main
const args = parseArgs();
runBenchmark(args).catch(e => {
    console.error('Benchmark error:', e.message);
    process.exit(1);
});
