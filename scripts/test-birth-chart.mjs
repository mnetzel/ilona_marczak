import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { calculateBirthChart, describeLongitude, normalizeLongitude, resolveBirthTime } from '../src/lib/birth-chart.ts';

const reference = JSON.parse(readFileSync(new URL('./fixtures/birth-chart-reference.json', import.meta.url), 'utf8'));
const angularError = (a, b) => Math.abs(normalizeLongitude(a - b + 180) - 180);

test('D1 chart matches 35 independent Swiss Ephemeris fixtures across 1900–2100 and both hemispheres', () => {
  for (const { input, utc, positions } of reference.fixtures) {
    const actual = calculateBirthChart(input);
    assert.equal(actual.utc, utc);
    assert.equal(actual.planets.length, 9);
    assert.equal(actual.ascendant.house, 1);
    for (const position of [actual.ascendant, ...actual.planets.filter(p => p.id !== 'ketu')]) {
      const label = `${input.date} ${input.time} ${input.latitude},${input.longitude}: ${position.id}`;
      // Astronomy Engine is an approximately arcminute analytical ephemeris.
      // Future Moon differences also include the engines' differing delta-T models.
      const tolerance = position.id === 'ascendant' ? 10 / 3600 : 2 / 60;
      assert.ok(angularError(position.longitude, positions[position.id].longitude) < tolerance, label);
      if (position.id !== 'ascendant') {
        assert.equal(position.retrograde, positions[position.id].speed < 0, `${label}: retrograde`);
      }
      assert.ok(position.degree >= 0 && position.degree < 30, label);
      assert.ok(position.house >= 1 && position.house <= 12, label);
      assert.ok(position.pada >= 1 && position.pada <= 4, label);
    }
    const rahu = actual.planets.find(p => p.id === 'rahu');
    const ketu = actual.planets.find(p => p.id === 'ketu');
    assert.ok(Math.abs(angularError(rahu.longitude, ketu.longitude) - 180) < 1e-9);
  }
});

test('local time uses historical offsets, summer time and fractional time zones', () => {
  const cases = [
    ['1990-01-12', '14:30', 'Europe/Warsaw', '1990-01-12T13:30:00Z', '+01:00'],
    ['1990-07-12', '14:30', 'Europe/Warsaw', '1990-07-12T12:30:00Z', '+02:00'],
    ['1990-07-12', '14:30', 'Asia/Kolkata', '1990-07-12T09:00:00Z', '+05:30'],
    ['1990-07-12', '14:30', 'Asia/Kathmandu', '1990-07-12T08:45:00Z', '+05:45'],
    ['1900-01-01', '12:00', 'Europe/Warsaw', '1900-01-01T10:36:00Z', '+01:24'],
    ['2024-10-27', '02:30', '+02:00', '2024-10-27T00:30:00Z', '+02:00'],
    ['2024-10-27', '02:30', '+01:00', '2024-10-27T01:30:00Z', '+01:00'],
  ];
  for (const [date, time, timeZone, utc, offset] of cases) {
    const result = resolveBirthTime({ date, time, timeZone });
    assert.equal(result.utc, utc);
    assert.equal(result.utcOffset, offset);
  }
});

test('DST gaps and repeated hours are rejected instead of silently moved', () => {
  assert.throws(() => resolveBirthTime({ date: '2024-03-31', time: '02:30', timeZone: 'Europe/Warsaw' }), { code: 'nonexistent-time' });
  assert.throws(() => resolveBirthTime({ date: '2024-10-27', time: '02:30', timeZone: 'Europe/Warsaw' }), { code: 'ambiguous-time' });
  assert.throws(() => resolveBirthTime({ date: '2024-03-10', time: '02:30', timeZone: 'America/New_York' }), { code: 'nonexistent-time' });
  assert.throws(() => resolveBirthTime({ date: '2024-11-03', time: '01:30', timeZone: 'America/New_York' }), { code: 'ambiguous-time' });
});

test('invalid dates, unsupported ranges and locations are rejected', () => {
  for (const [date, time, timeZone, code] of [
    ['1900-02-29', '12:00', 'UTC', 'invalid-date'],
    ['2100-02-29', '12:00', 'UTC', 'invalid-date'],
    ['1990-13-01', '12:00', 'UTC', 'invalid-date'],
    ['1990-01-01', '24:00', 'UTC', 'invalid-date'],
    ['1990-01-01', '23:59:60', 'UTC', 'invalid-date'],
    ['1899-12-31', '12:00', 'UTC', 'date-range'],
    ['2101-01-01', '12:00', 'UTC', 'date-range'],
    ['1990-01-01', '12:00', 'Europe/Nowhere', 'invalid-zone'],
  ]) {
    assert.throws(() => resolveBirthTime({ date, time, timeZone }), { code });
  }
  for (const [latitude, longitude] of [[90, 0], [NaN, 0], [0, Infinity], [0, 181]]) {
    assert.throws(() => calculateBirthChart({ date: '2000-01-01', time: '12:00', timeZone: 'UTC', latitude, longitude }), { code: 'invalid-location' });
  }
});

test('signs, nakshatras and padas assign exact boundaries to the next interval', () => {
  assert.equal(describeLongitude(0).signIndex, 0);
  assert.equal(describeLongitude(30).signIndex, 1);
  assert.equal(describeLongitude(360).signIndex, 0);
  assert.equal(describeLongitude(-0.01).signIndex, 11);
  assert.equal(describeLongitude(40 / 3).nakshatraIndex, 1);
  assert.equal(describeLongitude(120).nakshatraIndex, 9);
  assert.equal(describeLongitude(10 / 3).pada, 2);
  assert.equal(describeLongitude(20 / 3).pada, 3);
  assert.equal(describeLongitude(10).pada, 4);
  assert.equal(describeLongitude(40 / 3).pada, 1);
});
