import { choice, date, text, fail, escapeRegex } from '../middleware/validation.js';
import { reportDimensions, unknownCategory } from '../../shared/reportAnalytics.js';

// Both summary and explorer use these expressions, including missing/blank categories.
export const categoryExpression = field => ({ $let: { vars: { value: { $trim: { input: { $ifNull: ['$' + field, ''] } } } }, in: { $cond: [{ $eq: ['$$value', ''] }, unknownCategory, '$$value'] } } });

export function explorerQuery(type, query, scope) {
  const from = date(query.from), to = date(query.to);
  if (from > to) fail('The start date must be before the end date.');
  if ((Date.parse(to) - Date.parse(from)) / 86400000 > 3660) fail('Choose a report range of ten years or less.');
  const dateField = type === 'patients' ? 'created' : 'date';
  const conditions = [scope, { [dateField]: type === 'activity'
    ? { $gte: new Date(from + 'T00:00:00+08:00'), $lte: new Date(to + 'T23:59:59.999+08:00') }
    : { $gte: from, $lte: to } }];
  let filter = {};
  if (query.filter !== undefined) {
    const encoded = text(query.filter, 'Drill-down filter', { max: 6000 });
    try { filter = JSON.parse(encoded); } catch { fail('Drill-down filter is invalid.'); }
    if (!filter || typeof filter !== 'object' || Array.isArray(filter) || Object.keys(filter).some(key => !['field','value','exclude','from','to'].includes(key))) fail('Drill-down filter is invalid.');
    if (filter.from !== undefined || filter.to !== undefined) {
      const start = date(filter.from), end = date(filter.to);
      if (start < from || end > to || start > end) fail('Drill-down dates must be within the report range.');
      conditions.push({ [dateField]: type === 'activity' ? { $gte: new Date(start + 'T00:00:00+08:00'), $lte: new Date(end + 'T23:59:59.999+08:00') } : { $gte: start, $lte: end } });
    }
    if (filter.field !== undefined) {
      choice(filter.field, reportDimensions[type].map(([field]) => field), 'Drill-down category');
      if ((filter.value !== undefined) === (filter.exclude !== undefined)) fail('Choose one drill-down category filter.');
      const expr = categoryExpression(filter.field);
      if (filter.value !== undefined) conditions.push({ $expr: { $eq: [expr, { $literal: text(filter.value, 'Category', { required: true, max: 5000 }) }] } });
      else {
        if (!Array.isArray(filter.exclude) || filter.exclude.length !== 9) fail('Combined category filter is invalid.');
        const values = filter.exclude.map(value => text(value, 'Category', { required: true, max: 5000 }));
        conditions.push({ $expr: { $not: [{ $in: [expr, { $literal: values }] }] } });
      }
    } else if (filter.value !== undefined || filter.exclude !== undefined) fail('A drill-down category is required.');
  }
  const search = text(query.search, 'Search', { max: 100 });
  // Search operational fields only, never clinical notes or diagnoses.
  const fields = type === 'patients' ? ['id','name','status'] : type === 'activity' ? ['id','actor','action','recordId'] : ['id','displayReference','patientId','staff','type','status'];
  if (search) conditions.push({ $or: fields.map(field => ({ [field]: { $regex: escapeRegex(search), $options: 'i' } })) });
  const integer = (value, fallback, max, label) => { if (value === undefined) return fallback; if (typeof value !== 'string' || !/^\d+$/.test(value) || +value < 1 || +value > max) fail(label + ' is invalid.'); return +value; };
  const page = integer(query.page, 1, 10000, 'Page'), limit = integer(query.limit, 25, 100, 'Page size');
  const sort = choice(query.sort || 'date', ['id','person','date','details'], 'Sort column');
  const direction = choice(query.direction || 'desc', ['asc','desc'], 'Sort direction');
  const sortField = sort === 'date' ? dateField : sort === 'id' ? 'reference' : sort === 'person' ? type === 'patients' ? 'name' : type === 'activity' ? 'actor' : 'patientId' : type === 'patients' ? 'status' : type === 'activity' ? 'action' : 'type';
  return { match: { $and: conditions }, from, to, filter, search, page, limit, sort: { [sortField]: direction === 'asc' ? 1 : -1, id: direction === 'asc' ? 1 : -1 } };
}

export function summaryPipeline(type, match) {
  const group = field => [{ $group: { _id: categoryExpression(field), value: { $sum: 1 } } }, { $sort: { value: -1, _id: 1 } }];
  const facets = Object.fromEntries(reportDimensions[type].map(([field]) => [field, group(field)]));
  facets.total = [{ $count: 'value' }];
  facets.dates = [{ $group: { _id: type === 'activity' ? { $dateToString: { date: '$date', format: '%Y-%m-%d', timezone: 'Asia/Manila' } } : '$' + (type === 'patients' ? 'created' : 'date'), value: { $sum: 1 } } }, { $sort: { _id: 1 } }];
  return [{ $match: match }, { $facet: facets }];
}

export function recordsPipeline(type, config, exporting = false) {
  const projection = { _id: 0, id: 1, displayReference: 1, date: 1, created: 1, status: 1 };
  for (const field of type === 'patients' ? ['name','gender'] : type === 'activity' ? ['actor','action','recordType','recordId'] : ['patientId','staff','staffId','specialty','type','time']) projection[field] = 1;
  return [{ $match: config.match }, { $set: { reference: { $ifNull: ['$displayReference', '$id'] } } }, { $sort: config.sort }, { $facet: {
    total: [{ $count: 'value' }],
    items: [...(exporting ? [{ $limit: 10001 }] : [{ $skip: (config.page - 1) * config.limit }, { $limit: config.limit }]), { $project: projection }]
  } }];
}
