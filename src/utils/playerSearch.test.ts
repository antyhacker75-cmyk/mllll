import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYER_DIRECTORY } from '../data/playerDirectory';
import { findPlayerInDirectory, searchPlayerDirectory } from './playerSearch';

test('searchPlayerDirectory filters accounts by IGN, Game ID, region, and signature hero', () => {
  const byName = searchPlayerDirectory(PLAYER_DIRECTORY, 'Kairi');
  assert.equal(byName.length, 1);
  assert.equal(byName[0].info.name, 'Kairi');

  const byId = searchPlayerDirectory(PLAYER_DIRECTORY, '401293811');
  assert.equal(byId.length, 1);
  assert.equal(byId[0].info.name, 'AriaSenpai');

  const byRegion = searchPlayerDirectory(PLAYER_DIRECTORY, 'PH');
  assert.ok(byRegion.length >= 3);
  assert.ok(byRegion.every((p) => p.info.reg_country === 'PH'));

  const byHero = searchPlayerDirectory(PLAYER_DIRECTORY, 'Khufra');
  assert.ok(byHero.some((p) => p.info.name === 'Kiboy'));
});

test('findPlayerInDirectory resolves accounts cleanly by roleId or name', () => {
  const nox = findPlayerInDirectory(PLAYER_DIRECTORY, { roleId: 519204412 });
  assert.equal(nox?.info.name, 'NoxRoam');

  const sanz = findPlayerInDirectory(PLAYER_DIRECTORY, { name: 'sanz' });
  assert.equal(sanz?.info.roleId, 204918221);
});
