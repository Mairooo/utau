import { MeiliSearch } from 'meilisearch';

export default (router, { env, services, exceptions }) => {
  const ServiceUnavailableException = exceptions?.ServiceUnavailableException || class extends Error {};
  const ForbiddenException = exceptions?.ForbiddenException || class extends Error {};

  const client = new MeiliSearch({
    host: env.MEILISEARCH_HOST || 'http://localhost:7700',
    apiKey: env.MEILISEARCH_API_KEY
  });

  const indexName = `${env.MEILISEARCH_INDEX_PREFIX || 'directus_'}projects`;

  // Endpoint POST pour configurer l'index et importer les données
  router.post('/meilisearch', async (req, res) => {
    try {
      // Vérifier que l'utilisateur est admin
      if (!req.accountability?.admin) {
        throw new ForbiddenException('Accès réservé aux administrateurs');
      }

      // Créer ou récupérer l'index avec clé primaire explicite
      const index = client.index(indexName);
      
      // S'assurer que l'index existe avec la bonne clé primaire
      try {
        await client.createIndex(indexName, { primaryKey: 'id' });
      } catch (e) {
        // L'index existe déjà, c'est OK
        console.log('Index existe déjà ou erreur création:', e.message);
      }

      // Configuration de l'index
      const searchableAttributes = ['title', 'searchable_content', 'description', 'creator', 'voicebank_name'];
      const filterableAttributes = ['voicebank_id', 'creator_id', 'status', 'tempo', 'key_signature'];
      const sortableAttributes = ['likes', 'plays', 'tempo', 'duration'];

      await Promise.all([
        index.updateSearchableAttributes(searchableAttributes),
        index.updateFilterableAttributes(filterableAttributes),
        index.updateSortableAttributes(sortableAttributes)
      ]);

      // Importer tous les projets publiés existants
      const { ItemsService } = services;
      const projectsService = new ItemsService('Projects', {
        knex: req.knex,
        schema: await req.schema
      });

      const projects = await projectsService.readByQuery({
        filter: { status: { _eq: '1' } }, // '1' = published
        fields: ['*'],
        limit: -1
      });

      // Transformer les projets pour Meilisearch
      const documents = [];
      for (const project of projects) {
        try {
          // Récupérer les infos utilisateur
          let creator = '';
          let creator_id = null;
          if (project.user_created) {
            const usersService = new ItemsService('directus_users', {
              knex: req.knex,
              schema: await req.schema
            });
            try {
              const user = await usersService.readOne(project.user_created, {
                fields: ['id', 'first_name', 'last_name']
              });
              creator = `${user.first_name || ''} ${user.last_name || ''}`.trim();
              creator_id = user.id;
            } catch (e) {
              console.log('Erreur lecture user:', e.message);
            }
          }

          // Récupérer les infos voicebank
          let voicebank_name = '';
          let voicebank_id = null;
          if (project.primary_voicebank) {
            const voicebanksService = new ItemsService('voicebanks', {
              knex: req.knex,
              schema: await req.schema
            });
            try {
              const voicebank = await voicebanksService.readOne(project.primary_voicebank, {
                fields: ['id', 'name']
              });
              voicebank_name = voicebank.name || '';
              voicebank_id = voicebank.id;
            } catch (e) {
              console.log('Erreur lecture voicebank:', e.message);
            }
          }

          documents.push({
            id: project.id,
            title: project.title || '',
            searchable_content: `${project.title || ''} ${project.description || ''}`,
            description: project.description || '',
            tempo: parseInt(project.tempo) || 120,
            key_signature: project.key_signature || 'C',
            duration: parseInt(project.duration) || 0,
            creator,
            creator_id,
            voicebank_name,
            voicebank_id,
            plays: parseInt(project.plays) || 0,
            likes: parseInt(project.likes) || 0,
            status: project.status,
            collection: 'projects',
            cover_image: project.cover_image || null
          });
        } catch (error) {
          console.error(`Erreur transformation projet ${project.id}:`, error.message);
        }
      }

      // Ajouter les documents à l'index avec clé primaire explicite
      let task = null;
      if (documents.length > 0) {
        const result = await index.addDocuments(documents, { primaryKey: 'id' });
        task = result.taskUid;
      }

      // Récupérer les stats de l'index
      const stats = await index.getStats();

      res.json({
        success: true,
        message: 'Index Meilisearch configuré avec succès',
        indexName,
        documentsCount: documents.length,
        taskId: task,
        configuration: {
          searchableAttributes,
          filterableAttributes,
          sortableAttributes
        },
        stats
      });

    } catch (error) {
      console.error('Erreur configuration Meilisearch:', error);
      throw new ServiceUnavailableException(`Erreur de configuration: ${error.message}`);
    }
  });

  // Endpoint GET pour vérifier le statut de l'index
  router.get('/meilisearch/status', async (req, res) => {
    try {
      // Vérifier la santé de Meilisearch
      const health = await client.health();

      const index = client.index(indexName);
      let indexInfo = null;
      let stats = null;

      try {
        stats = await index.getStats();
        const settings = await index.getSettings();
        indexInfo = {
          name: indexName,
          documentsCount: stats.numberOfDocuments,
          isIndexing: stats.isIndexing,
          settings
        };
      } catch (error) {
        if (error.code === 'index_not_found') {
          indexInfo = {
            name: indexName,
            exists: false,
            message: 'Index non configuré. Appelez POST /search-setup/meilisearch'
          };
        } else {
          throw error;
        }
      }

      res.json({
        meilisearch: {
          status: health.status,
          host: env.MEILISEARCH_HOST || 'http://localhost:7700'
        },
        index: indexInfo
      });

    } catch (error) {
      console.error('Erreur statut Meilisearch:', error);
      throw new ServiceUnavailableException(`Erreur de statut: ${error.message}`);
    }
  });
};
