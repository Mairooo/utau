import { MeiliSearch } from 'meilisearch';

export default (router, { env, services, exceptions }) => {
  const ServiceUnavailableException = exceptions?.ServiceUnavailableException || class extends Error {};

  const client = new MeiliSearch({
    host: env.MEILISEARCH_HOST || 'http://localhost:7700',
    apiKey: env.MEILISEARCH_API_KEY
  });

  const indexName = `${env.MEILISEARCH_INDEX_PREFIX || 'directus_'}projects`;

  // Endpoint de recherche principal
  router.get('/projects', async (req, res) => {
    try {
      // Vérification de la connexion Meilisearch
      const health = await client.health();
      if (health.status !== 'available') {
        throw new Error('Meilisearch non disponible');
      }

      const index = client.index(indexName);

      // Vérification de l'existence de l'index
      try {
        await index.getStats();
      } catch (error) {
        if (error.code === 'index_not_found') {
          return res.status(500).json({
            error: 'Index non configuré',
            message: 'Appelez POST /search-setup/meilisearch pour initialiser l\'index'
          });
        }
        throw error;
      }

      const { q, limit = 20, offset = 0, voicebank, creator, sort, tags } = req.query;

      const searchOptions = {
        limit: parseInt(limit),
        offset: parseInt(offset),
        attributesToRetrieve: ['*'],
        attributesToHighlight: ['title', 'searchable_content'],
        highlightPreTag: '<mark>',
        highlightPostTag: '</mark>',
        attributesToCrop: ['searchable_content'],
        cropLength: 100
      };

      // Construction des filtres
      const filters = [];
      if (voicebank) {
        filters.push(`voicebank_id = "${voicebank}"`);
      }
      if (creator) {
        filters.push(`creator_id = "${creator}"`);
      }
      
      // Filtrage par tags (support de plusieurs tags)
      if (tags) {
        const tagIds = tags.split(',').map(t => t.trim()).filter(t => t);
        if (tagIds.length > 0) {
          // Pour chaque tag sélectionné, ajouter un filtre séparé (AND implicite)
          tagIds.forEach(tagId => {
            filters.push(`tag_ids = "${tagId}"`);
          });
        }
      }

      if (filters.length > 0) {
        searchOptions.filter = filters.join(' AND ');
      }

      // Gestion du tri
      if (sort) {
        const sortOptions = [];
        sort.split(',').forEach(s => {
          // Remplacer "likes" par "likes_count" (alias frontend -> backend)
          let sortField = s.replace('likes_asc', 'likes_count_asc')
                           .replace('likes_desc', 'likes_count_desc');
          
          if (sortField.endsWith('_asc')) {
            sortOptions.push(sortField.replace('_asc', ':asc'));
          } else if (sortField.endsWith('_desc')) {
            sortOptions.push(sortField.replace('_desc', ':desc'));
          }
        });
        if (sortOptions.length > 0) {
          searchOptions.sort = sortOptions;
        }
      }

      // Exécution de la recherche
      const results = await index.search(q || '', searchOptions);

      res.json({
        hits: results.hits,
        query: q,
        totalHits: results.estimatedTotalHits,
        processingTimeMs: results.processingTimeMs,
        facetDistribution: results.facetDistribution,
        pagination: {
          offset: parseInt(offset),
          limit: parseInt(limit),
          hasNext: results.hits.length === parseInt(limit)
        }
      });

    } catch (error) {
      console.error('Erreur recherche Meilisearch:', error);
      throw new ServiceUnavailableException(`Erreur de recherche: ${error.message}`);
    }
  });

  // Endpoint de suggestions d'autocomplétion
  router.get('/projects/suggest', async (req, res) => {
    try {
      const { q, limit = 5 } = req.query;
      if (!q) {
        return res.json({ suggestions: [] });
      }

      const index = client.index(indexName);
      const results = await index.search(q, {
        limit: parseInt(limit),
        attributesToRetrieve: ['id', 'title', 'creator', 'voicebank_name'],
        attributesToHighlight: ['title'],
        highlightPreTag: '<mark>',
        highlightPostTag: '</mark>'
      });

      res.json({
        suggestions: results.hits.map(hit => ({
          id: hit.id,
          title: hit.title,
          creator: hit.creator,
          voicebank: hit.voicebank_name,
          highlighted: hit._formatted?.title || hit.title
        }))
      });

    } catch (error) {
      throw new ServiceUnavailableException(`Erreur suggestions: ${error.message}`);
    }
  });
};
