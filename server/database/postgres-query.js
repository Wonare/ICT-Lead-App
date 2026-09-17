'use strict';

// Controllers use mysql-style positional placeholders. Their SQL is internal;
// values are always bound separately. Preserve question marks inside literals.
function translateQuery(sql) {
  let index = 0;
  let result = sql.replace(/'(?:''|[^'])*'|\?/g, match => match === '?' ? '$' + (++index) : match);
  result = result.replace(/\bLIKE\b/g, 'ILIKE');
  if (/^\s*INSERT\b/i.test(result) && !/\bRETURNING\b/i.test(result)) result += ' RETURNING id';
  return result;
}
module.exports = { translateQuery };
