import { Router, json } from 'express';
import mirrors from '../../../mirrors';
import { isErrorMessage } from '../../../mirrors/types/errorMessages';
import type MirrorInterface from '../../../mirrors/model/types';


// config express route
const route = Router();
route.use(json());
// get a list of all mirrors at startup
const mirrorsList = mirrors.map(mirror => {
  return {
    name: mirror.name,
    host: mirror.host,
    enabled: mirror.enabled,
    icon: mirror.icon,
  };
});

/**
 * Get a list of all mirrors
 */
route.get('/list', (req, res) => {
  res.json(mirrorsList);
});

/**
 * Search a manga by name through all mirrors
 */
 route.post('/search', async (req, res) => {
  const body = req.body as {query: string} | undefined;
  // safeguards
  if(!body?.query) return res.status(400).json({error: 'query_missing'});
  if(typeof body.query !== 'string') return res.status(400).json({error: 'query_invalid'});
  if(body.query.length < 3) return res.status(400).json({error: 'query_too_short'});
  // search through all enabled mirrors
  const enabledMirror = mirrors.filter(mirror => mirror.enabled);
  const results = await Promise.all(
    enabledMirror.map(async m => {
      const searchResult = await m.search(body.query);
      if(isErrorMessage(searchResult)) {
        return {
          mirror: m.name,
          ...searchResult,
        };
      }
      return { mirror: m.name, results: searchResult};
    }),
  );

 return res.json(results);
});

// build mirror specific routes
route.use('/:mirror', (req, res, next) => {
  const mirror = mirrors.find(m=> m.name === req.params.mirror);
  if(!mirror) return res.status(400).json({error: 'mirror_not_found'});
  if(!mirror.enabled) return res.status(400).json({error: 'mirror_disabled'});
  res.locals.mirror = mirror;
  next();
});

// build mirror specific routes
route.get('/:mirror', (req, res) => {
  const mirror = res.locals.mirror as MirrorInterface;
  res.json({
    name: mirror.name,
    host: mirror.host,
    enabled: mirror.enabled,
    icon: mirror.icon,
    options: mirror.options,
  });
});

route.get('/:mirror/search', (req, res) => {
  return res.status(400).json({error: 'use_post_method'});
});

route.post('/:mirror/search', async (req, res) => {
  const mirror = res.locals.mirror as MirrorInterface;
  const body = req.body as {query: string} | undefined;
  // safeguards
  if(!body?.query) return res.status(400).json({error: 'query_missing'});
  if(typeof body.query !== 'string') return res.status(400).json({error: 'query_invalid'});
  if(body.query.length < 3) return res.status(400).json({error: 'query_too_short'});
  // querying
  const results = await mirror.search(body.query);
  if(isErrorMessage(results)) return res.status(500).json(results);
  return res.json(results);
});

route.get('/:mirror/manga', (req, res) => {
  return res.status(400).json({error: 'use_post_method'});
});

route.post('/:mirror/manga', async (req, res) => {
  const mirror = res.locals.mirror as MirrorInterface;
  const body = req.body as {query: string} | undefined;
  // safeguards
  if(!body?.query) return res.status(400).json({error: 'query_missing'});
  if(typeof body.query !== 'string') return res.status(400).json({error: 'query_invalid'});
  if(body.query.length === 0) return res.status(400).json({error: 'query_empty'});
  // querying
  const manga = await mirror.manga(body.query);
  if(isErrorMessage(manga)) return res.status(500).json(manga);
  return res.json(manga);
});

route.post('/:mirror/chapter', async (req, res) => {
  const mirror = res.locals.mirror as MirrorInterface;
  const body = req.body as {query: string} | undefined;
  // safeguards
  if(!body?.query) return res.status(400).json({error: 'query_missing'});
  if(typeof body.query !== 'string') return res.status(400).json({error: 'query_invalid'});
  if(body.query.length === 0) return res.status(400).json({error: 'query_empty'});
  // querying
  const manga = await mirror.chapter(body.query);
  if(isErrorMessage(manga)) return res.status(500).json(manga);
  return res.json(manga);
});

route.get('/:mirror/options', (req, res) => {
  const mirror = res.locals.mirror as MirrorInterface;
  res.json(mirror.options || {});
});

route.post('/:mirror/options', async (req, res) => {
  const mirror = res.locals.mirror as MirrorInterface;
  const body = req.body as {query : { [key: string]: unknown } } | undefined;
  // safeguards
  if(!body?.query) return res.status(400).json({error: 'query_missing'});
  if(typeof body.query !== 'object') return res.status(400).json({error: 'query_invalid'});
  if(Object.keys(body.query).length === 0) return res.status(400).json({error: 'query_empty'});
  // querying
  for(const [key, val] of Object.entries(body.query)) {
    if(!mirror.options) return res.status(400).json({error: 'options_not_available'});
    if(typeof mirror.options[key] === 'undefined') return res.status(400).json({error: 'option_unknown'});
    if(typeof val !== mirror.options[key]) return res.status(400).json({error: 'option_type_invalid'});
    mirror.options[key] = val;
  }
  return res.json(body.query);
});

export default route;
