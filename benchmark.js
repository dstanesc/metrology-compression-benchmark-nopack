import Benchmark from 'benchmark'

import {
  partReport,
  multipartReport
} from '@dstanesc/fake-metrology-data'

import { pack } from 'msgpackr';

import * as lz4 from 'lz4js'
import * as pako from 'pako'
import * as brotli from 'brotli'

import { plot } from './plot.js';

const encoder = new TextEncoder()

const rate = (origSize, deflatedSize) => {
  return (((origSize - deflatedSize) / origSize) * 100).toFixed(2);
}

const miB = (size) => {
  return (size / (1024 * 1024)).toFixed(2);
}

const metrologyPartReportData = (args) => {
  const reportJson = partReport(args)
  const buf = encoder.encode(JSON.stringify(reportJson));
  const bufSize = buf.byteLength;
  console.log(`Metrology report ${args.reportSize} measurements, original size ${miB(bufSize)} MiB`);
  return { buf, bufSize, json: reportJson }
}

const bench = ({ buf, bufSize, json }, options) => {
  const serPackr = pack(json);
  const serPako = pako.deflate(buf, options.pako);
  const serLz4 = lz4.compress(buf);
  const serBrotli = brotli.compress(buf, options.brotli);

  const serPackrSize = serPackr.byteLength;
  const serPakoSize = serPako.byteLength;
  const serLz4Size = serLz4.byteLength;
  const serBrotliSize = serBrotli.byteLength;

  const packrRate = rate(bufSize, serPackrSize);
  const brotliRate = rate(bufSize, serBrotliSize);
  const pakoRate = rate(bufSize, serPakoSize);
  const lz4jsRate = rate(bufSize, serLz4Size);

  console.log(`Packing only, report size ${miB(bufSize)} MiB, packr ${JSON.stringify(options.brotli)} packed size ${miB(serPackrSize)} MiB, packing rate ${packrRate} %`);
  console.log(`Compression, report size ${miB(bufSize)} MiB, brotli ${JSON.stringify(options.brotli)} compressed size ${miB(serBrotliSize)} MiB, compression rate ${brotliRate} %`);
  console.log(`Compression, report size ${miB(bufSize)} MiB, pako ${JSON.stringify(options.pako)} compressed size ${miB(serPakoSize)} MiB, compression rate ${pakoRate} %`);
  console.log(`Compression, report size ${miB(bufSize)} MiB, lz4 (default) compressed size ${miB(serLz4Size)} MiB, compression rate ${lz4jsRate} %`);

  const compressSuite = new Benchmark.Suite('Metrology Packing Suite')

  compressSuite.on('complete', event => {
    const suite = event.currentTarget;
    const fastestOption = suite.filter('fastest').map('name')
    console.log(`The fastest option is ${fastestOption}`)
    console.log()
  })

  let brotliHz;
  let pakoHz;
  let lz4jsHz;
  let packrHz;

  compressSuite.on('cycle', event => {
    const benchmark = event.target;
    console.log(benchmark.toString());
    switch (benchmark.name) {
      case 'Packr':
        packrHz = Math.floor(benchmark.hz);
        break;
      case 'Brotli':
        brotliHz = Math.floor(benchmark.hz);
        break;
      case 'Pako':
        pakoHz = Math.floor(benchmark.hz);
        break;
      case 'Lz4js':
        lz4jsHz = Math.floor(benchmark.hz);
        break;
    }
  });

  compressSuite
    .add('Packr', async () => {
      const ser = pack(json);
    })
    .add('Brotli', async () => {
      const ser = brotli.compress(buf, options.brotli);
    })
    .add('Pako', async () => {
      const ser = pako.deflate(buf, options.pako);
    })
    .add('Lz4js', async () => {
      const ser = lz4.compress(buf);
    })
    .run()

  return { initial: miB(bufSize), compressed: { packr: miB(serPackrSize), brotli: miB(serBrotliSize), pako: miB(serPakoSize), lz4js: miB(serLz4Size) }, ops: { packr: packrHz, brotli: brotliHz, pako: pakoHz, lz4js: lz4jsHz }, rate: { packr: packrRate, brotli: brotliRate, pako: pakoRate, lz4js: lz4jsRate }, options: { brotli: options.brotli.quality, pako: options.pako.level } }
}

const rep100 = metrologyPartReportData({ reportSize: 100 }); // 100 measurements 
const rep300 = metrologyPartReportData({ reportSize: 300 }); // 300 measurements 
const rep900 = metrologyPartReportData({ reportSize: 900 }); // 900 measurements 
const rep2700 = metrologyPartReportData({ reportSize: 2700 }); // 2700 measurements 

console.log()

const qualityBench = (metrologyData) => {
  //const min = bench(metrologyData, { brotli: { quality: 1 }, pako: { level: 1 } });  // min compression
  const med = bench(metrologyData, { brotli: { quality: 5 }, pako: { level: 5 } });  // medium compression
  // const max = bench(metrologyData, { brotli: { quality: 11 }, pako: { level: 9 } }); // max compression
  return { med }
}

let res100 = qualityBench(rep100);

plot(res100)

let res300 = qualityBench(rep300);

plot(res300)

let res900 = qualityBench(rep900);

plot(res900)

let res2700 = qualityBench(rep2700);

plot(res2700)
