/* Harness de validación del backend demo (offline). Ejecuta la lógica real de
 * src/demo/demoDb.ts en Node, con AsyncStorage mockeado en memoria. */
require('@babel/register')({
  extensions: ['.ts', '.tsx', '.js'],
  presets: [['@babel/preset-typescript']],
  plugins: [
    '@babel/plugin-transform-modules-commonjs',
    ['module-resolver', {
      root: ['./'],
      alias: {
        '@': './src',
        '@components': './src/components',
        '@context': './src/context',
        '@features': './src/features',
        '@navigation': './src/navigation',
        '@store': './src/store',
        '@services': './src/services',
        '@utils': './src/utils',
        '@constants': './src/constants',
        '@hooks': './src/hooks',
        '@react-native-async-storage/async-storage': './scripts/_mocks/asyncStorageMock.js',
      },
    }],
  ],
  cache: false,
});

let pass = 0;
let fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('  ✅', name); }
  else { fail++; console.log('  ❌', name); }
}

(async () => {
  const { demoDb } = require('../src/demo/demoDb.ts');
  await demoDb.reset();

  console.log('\n── AUTH ──');
  const seedClient = await demoDb.findProfileByPhone('88883333');
  ok('seed cliente existe', !!seedClient && seedClient.role === 'client');
  const seedWorker = await demoDb.findProfileByPhone('88884444');
  ok('seed técnico existe y activo', !!seedWorker && seedWorker.worker_status === 'active');
  ok('número inexistente devuelve null', (await demoDb.findProfileByPhone('00000000')) === null);

  const nuevo = await demoDb.createProfile({ full_name: 'Ana Nueva', phone: '77771111', role: 'client' });
  ok('registro crea perfil con id', !!nuevo.id && nuevo.phone === '77771111');
  ok('perfil nuevo recuperable por teléfono', (await demoDb.findProfileByPhone('77771111'))?.id === nuevo.id);
  ok('cliente nuevo aprobado', nuevo.is_approved === true);

  const nuevoWorker = await demoDb.createProfile({ full_name: 'Beto Téc', phone: '77772222', role: 'worker' });
  ok('técnico nuevo arranca incomplete', nuevoWorker.worker_status === 'incomplete');

  console.log('\n── PUBLICAR / FEED ──');
  const feed0 = await demoDb.listOpenJobs();
  ok('feed inicial tiene 2 seed jobs', feed0.length === 2);
  const job = await demoDb.createJob({
    title: 'Pintar sala', description: 'Pared blanca', category: 'pintura',
    payAmount: 800, address: 'Managua', lat: 12.1, lng: -86.2,
    durationHours: 3, requiredWorkers: 1, createdBy: seedClient.id,
  });
  ok('createJob devuelve job open con creator', job.status === 'open' && !!job.creator);
  ok('platform_fee = 5%', job.platform_fee === 40);
  ok('worker_payout = 95%', job.worker_payout === 760);
  const feed1 = await demoDb.listOpenJobs();
  ok('feed ahora tiene 3', feed1.length === 3);
  ok('nuevo job aparece primero (unshift)', feed1[0].id === job.id);
  const feedPintura = await demoDb.listOpenJobs({ categories: ['pintura'] });
  ok('filtro por categoría funciona', feedPintura.length === 1 && feedPintura[0].id === job.id);

  console.log('\n── ACEPTAR ──');
  const assignment = await demoDb.acceptJob(job.id, seedWorker.id);
  ok('aceptar crea asignación approved', assignment.selection_status === 'approved' && assignment.worker_id === seedWorker.id);
  const jobAfter = await demoDb.getJobById(job.id);
  ok('job pasa a assigned', jobAfter.status === 'assigned');
  ok('job.assigned_worker_id seteado', jobAfter.assigned_worker_id === seedWorker.id);
  const feed2 = await demoDb.listOpenJobs();
  ok('job aceptado sale del feed abierto', !feed2.some((j) => j.id === job.id));
  let threw = false;
  try { await demoDb.acceptJob(job.id, nuevoWorker.id); } catch { threw = true; }
  ok('no se puede aceptar un job ya tomado', threw);

  console.log('\n── MIS CHAMBAS (técnico) ──');
  const misChambas = await demoDb.listWorkerAssignments(seedWorker.id);
  ok('técnico ve su asignación con job embebido', misChambas.length === 1 && misChambas[0].job?.id === job.id);

  console.log('\n── FLUJO OPERATIVO ──');
  await demoDb.advancePhase(job.id, 'en_route');
  ok('en_route → taken', (await demoDb.getJobById(job.id)).status === 'taken');
  await demoDb.advancePhase(job.id, 'arrived');
  ok('arrived → in_progress', (await demoDb.getJobById(job.id)).status === 'in_progress');
  await demoDb.setJobStatus(job.id, 'completed');
  const done = await demoDb.getJobById(job.id);
  ok('completado', done.status === 'completed' && done.operational_phase === 'completed');
  const asgDone = (await demoDb.listWorkerAssignments(seedWorker.id))[0];
  ok('asignación tiene completed_at', !!asgDone.completed_at);

  console.log('\n── PANEL CLIENTE / HISTORIAL ──');
  const orders = await demoDb.listClientOrders(seedClient.id);
  const clientJob = orders.find((o) => o.id === job.id);
  ok('cliente ve su job', !!clientJob);
  ok('job muestra técnico asignado', clientJob.assigned_worker?.id === seedWorker.id);
  ok('historial incluye el completado', orders.some((o) => o.status === 'completed'));

  console.log('\n── CANCELAR ──');
  const job2 = await demoDb.createJob({
    title: 'Otro', description: 'x', category: 'pintura',
    payAmount: 500, address: 'Managua', lat: 12.1, lng: -86.2,
    durationHours: 1, requiredWorkers: 1, createdBy: seedClient.id,
  });
  await demoDb.setJobStatus(job2.id, 'cancelled');
  ok('cancelar setea cancelled', (await demoDb.getJobById(job2.id)).status === 'cancelled');

  console.log('\n── CHAT ──');
  const m1 = await demoDb.addJobMessage(job.id, seedClient.id, 'Hola, ¿cuándo llegás?');
  const m2 = await demoDb.addJobMessage(job.id, seedWorker.id, 'En 20 min');
  const msgs = await demoDb.listJobMessages(job.id);
  ok('chat guarda y ordena 2 mensajes', msgs.length === 2 && msgs[0].id === m1.id && msgs[1].id === m2.id);
  const ctx = await demoDb.getJobChatContext(job.id);
  ok('contexto de chat resuelve cliente y técnico', ctx.clientId === seedClient.id && ctx.workerId === seedWorker.id);

  console.log('\n── PERSISTENCIA ──');
  const dump = require('./_mocks/asyncStorageMock.js').__dump();
  ok('estado persistido en AsyncStorage', !!dump['CHAMBA_DEMO_DB_V1'] && dump['CHAMBA_DEMO_DB_V1'].includes('Pintar sala'));

  console.log('\n── RESET ──');
  await demoDb.reset();
  const feedReset = await demoDb.listOpenJobs();
  ok('reset vuelve a 2 seed jobs', feedReset.length === 2);
  ok('reset borra perfiles nuevos', (await demoDb.findProfileByPhone('77771111')) === null);

  console.log(`\n${'='.repeat(40)}\nRESULTADO: ${pass} passed, ${fail} failed\n${'='.repeat(40)}`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((err) => {
  console.error('\n💥 Harness crashed:', err);
  process.exit(1);
});
