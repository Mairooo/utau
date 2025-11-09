import { MeiliSearch } from 'meilisearch';

export default ({ filter, action }, { env, services, logger }) => {
  // Configuration du client Meilisearch
  const client = new MeiliSearch({
    host: env.MEILISEARCH_HOST || 'http://localhost:7700',
    apiKey: env.MEILISEARCH_API_KEY
  });

  const indexName = `${env.MEILISEARCH_INDEX_PREFIX || 'directus_'}projects`;
  const index = client.index(indexName);

  // Fonction utilitaire pour transformer un projet pour Meilisearch
  async function transformProjectForSearch(projectId, context) {
    try {
      const { ItemsService } = services;
      const projectsService = new ItemsService('Projects', {
        knex: context.database || services.knex,
        schema: context.schema || await context.getSchema() || services.schema,
        accountability: context.accountability
      });

      const project = await projectsService.readOne(projectId, {
        fields: [
          '*',
          'likes_count',
          'user_created.id',
          'user_created.first_name',
          'user_created.last_name',
          'user_created.email',
          'primary_voicebank.id',
          'primary_voicebank.name',
          'tags.Tags_id',
          'cover_image'
        ]
      });

      if (!project || project.status !== '1') {
        return null; // Ne pas indexer les projets non publiés
      }

      // Extraire les IDs des tags
      let tag_ids = [];
      if (project.tags && Array.isArray(project.tags)) {
        tag_ids = project.tags
          .map(t => t.Tags_id)
          .filter(id => id);
      }

      return {
        id: project.id,
        title: project.title || '',
        searchable_content: `${project.title || ''} ${project.description || ''}`,
        description: project.description || '',
        tempo: parseInt(project.tempo) || 120,
        key_signature: project.key_signature || 'C',
        duration: parseInt(project.duration) || 0,
        creator: `${project.user_created?.first_name || ''} ${project.user_created?.last_name || ''}`.trim(),
        creator_id: project.user_created?.id,
        voicebank_name: project.primary_voicebank?.name || '',
        voicebank_id: project.primary_voicebank?.id,
        plays: parseInt(project.plays) || 0,
        likes_count: parseInt(project.likes_count) || 0,
        status: project.status,
        collection: 'projects',
        cover_image: project.cover_image || null,
        tag_ids
      };
    } catch (error) {
      logger.error(`Erreur transformation projet ${projectId}:`, error.message);
      return null;
    }
  }

  // Hook CREATE : Nouveau projet créé
  action('items.create', async ({ collection, item, key }, context) => {
    if (collection === 'Projects') {
      try {
        const document = await transformProjectForSearch(key, context);
        if (document) {
          await index.addDocuments([document], { primaryKey: 'id' });
          logger.info(`Projet ${key} ajouté à l'index Meilisearch`);
        }
      } catch (error) {
        logger.error(`Erreur sync CREATE:`, error.message);
      }
    }
  });

  // Hook UPDATE : Projet modifié
  action('items.update', async ({ collection, item, keys }, context) => {
    if (collection === 'Projects') {
      try {
        for (const key of keys) {
          const document = await transformProjectForSearch(key, context);
          if (document) {
            // Projet publié : ajouter ou mettre à jour dans l'index
            // addDocuments fonctionne pour les nouveaux ET les existants
            await index.addDocuments([document], { primaryKey: 'id' });
            logger.info(`Projet ${key} ajouté/mis à jour dans Meilisearch`);
          } else {
            // Projet dépublié : supprimer de l'index
            try {
              await index.deleteDocument(key);
              logger.info(`Projet ${key} supprimé de l'index Meilisearch`);
            } catch (e) {
              // Document n'existait peut-être pas, ce n'est pas grave
              logger.info(`Projet ${key} n'était pas dans l'index`);
            }
          }
        }
      } catch (error) {
        logger.error(`Erreur sync UPDATE projets:`, error.message);
      }
    }
  });

  // Hook DELETE : Projet supprimé
  action('items.delete', async ({ collection, payload }) => {
    if (collection === 'Projects') {
      try {
        const keys = Array.isArray(payload) ? payload : [payload];
        await index.deleteDocuments(keys);
        logger.info(`Projets ${keys.join(', ')} supprimés de Meilisearch`);
      } catch (error) {
        logger.error(`Erreur sync DELETE projets:`, error.message);
      }
    }
  });

  // Hook pour synchroniser quand les tags d'un projet sont modifiés
  // (via la table de jonction Projects_Tags)
  action('items.create', async ({ collection, item }, context) => {
    if (collection === 'Projects_Tags') {
      try {
        // Un nouveau tag a été ajouté à un projet, resynchroniser ce projet
        const projectId = item.Projects_id;
        if (projectId) {
          const document = await transformProjectForSearch(projectId, context);
          if (document) {
            await index.addDocuments([document], { primaryKey: 'id' });
            logger.info(`Projet ${projectId} resynchronisé suite à ajout de tag`);
          }
        }
      } catch (error) {
        logger.error(`Erreur sync CREATE Projects_Tags:`, error.message);
      }
    }
  });

  action('items.delete', async ({ collection, payload }, context) => {
    if (collection === 'Projects_Tags') {
      try {
        // Un tag a été retiré d'un projet, resynchroniser ce projet
        const items = Array.isArray(payload) ? payload : [payload];
        for (const itemId of items) {
          // Pour récupérer le Projects_id, on doit lire l'item avant suppression
          // Mais comme c'est après suppression, on doit utiliser les keys passées
          // On va plutôt utiliser le hook update sur Projects directement
          logger.info(`Tag retiré, sync via update du projet`);
        }
      } catch (error) {
        logger.error(`Erreur sync DELETE Projects_Tags:`, error.message);
      }
    }
  });

  logger.info('Hook Meilisearch initialisé pour les collections Projects et Projects_Tags');
};
