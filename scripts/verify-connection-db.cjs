// Read-only schema/constraint checks. No user accounts or preference records are created.
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const product = require('../shared/product.json');
function query(sql) {
  const out = JSON.parse(cp.execFileSync('npx', ['-y', '@insforge/cli', 'db', 'query', sql, '--json'], { encoding: 'utf8' }));
  return out.rows;
}
const relation = query("select relrowsecurity as rls from pg_class where oid = 'public.connection_preferences'::regclass")[0];
assert.equal(relation.rls, true);
const grants = query("select has_table_privilege('anon','public.connection_preferences','SELECT') as anon_read, has_table_privilege('anon','public.connection_preferences','INSERT') as anon_write, has_table_privilege('authenticated','public.connection_preferences','SELECT,INSERT,UPDATE,DELETE') as authenticated_access")[0];
assert.equal(grants.anon_read, false); assert.equal(grants.anon_write, false); assert.equal(grants.authenticated_access, true);
const policies = query("select cmd,qual,with_check from pg_policies where schemaname='public' and tablename='connection_preferences'");
assert.equal(policies.length, 4);
for (const command of ['SELECT','INSERT','UPDATE','DELETE']) {
  const policy = policies.find(p => p.cmd === command); assert.ok(policy);
  for (const clause of command === 'INSERT' ? ['with_check'] : command === 'UPDATE' ? ['qual','with_check'] : ['qual']) {
    assert.match(policy[clause], /user_id =/); assert.match(policy[clause], /auth\.uid\(\)/);
  }
}
const definition = query("select pg_get_constraintdef(oid) as definition from pg_constraint where conrelid='public.connection_preferences'::regclass and conname='connection_answers_valid'")[0].definition;
const expression = definition.replace(/^CHECK \(/, '').replace(/\)$/, '');
const examples = [{ answers: {}, expected: true }, { answers: { unknown: 'value' }, expected: false }, { answers: { pace: null }, expected: false }, { answers: { pace: 'invalid' }, expected: false }];
for (const question of product.connectionOnboarding.questions) for (const option of question.options) examples.push({ answers: { [question.id]: option.id }, expected: true });
const values = examples.map((example, index) => `(${index},'${JSON.stringify(example.answers).replaceAll("'", "''")}'::jsonb)`).join(',');
const results = query(`select i,(${expression}) is true as accepted from (values ${values}) as cases(i,answers) order by i`);
for (const row of results) assert.equal(row.accepted, examples[row.i].expected, `Constraint case ${row.i}`);
console.log(`Private preference table verified: RLS, four owner policies, anonymous access denied, ${results.length} answer validation cases.`);
