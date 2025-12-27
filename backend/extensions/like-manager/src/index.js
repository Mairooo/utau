export default {
  id: 'like-manager',
  handler: (router, { services, database, getSchema, logger }) => {
    const { ItemsService } = services;

    // POST /like-manager/toggle - Like/Unlike un projet
    router.post('/toggle', async (req, res) => {
      try {
        const { project_id } = req.body;
        const user_id = req.accountability?.user;

        if (!project_id || !user_id) {
          return res.status(400).json({
            error: 'project_id et user_id requis'
          });
        }

        const schema = await getSchema();
        const likesService = new ItemsService('projects_likes', { schema, accountability: req.accountability });
        const projectsService = new ItemsService('Projects', { schema, accountability: req.accountability });

        // 1. Vérifier si l'utilisateur a déjà liké ce projet
        const existingLikes = await likesService.readByQuery({
          filter: {
            project_id: { _eq: project_id },
            user_id: { _eq: user_id }
          }
        });

        let action, message;

        if (existingLikes.length > 0) {
          // UNLIKE : L'utilisateur retire son like
          await likesService.deleteOne(existingLikes[0].id);

          // Décrémenter le compteur de likes dans le projet
          const project = await projectsService.readOne(project_id, { fields: ['likes_count'] });
          const newCount = Math.max(0, (project.likes_count || 0) - 1);
          
          await projectsService.updateOne(project_id, {
            likes_count: newCount
          });

          action = 'unliked';
          message = 'Like retiré avec succès';

        } else {
          // LIKE : L'utilisateur ajoute son like
          await likesService.createOne({
            project_id,
            user_id
          });

          // Incrémenter le compteur de likes dans le projet
          const project = await projectsService.readOne(project_id, { fields: ['likes_count'] });
          const newCount = (project.likes_count || 0) + 1;
          
          await projectsService.updateOne(project_id, {
            likes_count: newCount
          });

          action = 'liked';
          message = 'Projet liké avec succès';
        }

        // 2. Récupérer les données du projet mis à jour
        const updatedProject = await projectsService.readOne(project_id, {
          fields: ['id', 'title', 'likes_count', 'user_created.first_name', 'user_created.last_name']
        });

        // 3. Récupérer les infos de l'utilisateur qui like
        const usersService = new ItemsService('directus_users', { schema, accountability: req.accountability });
        const currentUser = await usersService.readOne(user_id, { 
          fields: ['first_name', 'last_name', 'email'] 
        });

        // 4. Créer une notification pour le propriétaire du projet (seulement pour les likes)
        if (action === 'liked') {
          // Récupérer l'ID du propriétaire du projet
          const projectOwner = await projectsService.readOne(project_id, {
            fields: ['user_created']
          });
          
          logger.info(`Project owner data: ${JSON.stringify(projectOwner)}`);
          
          const ownerId = typeof projectOwner.user_created === 'object' 
            ? projectOwner.user_created.id 
            : projectOwner.user_created;

          logger.info(`Owner ID: ${ownerId}, Current user ID: ${user_id}, Same? ${ownerId === user_id}`);

          // Ne pas notifier si l'utilisateur like son propre projet
          if (ownerId && ownerId !== user_id) {
            try {
              const notificationsService = new ItemsService('notifications', { 
                schema, 
                knex: database
              });

              logger.info(`Creating notification for user ${ownerId}...`);

              const notifId = await notificationsService.createOne({
                user_id: ownerId,
                message: `${currentUser.first_name} ${currentUser.last_name} a aimé votre projet "${updatedProject.title}"`,
                project_id: project_id,
                event_type: 'nouveau_like',
                status: 'non_lu',
                triggered_by: user_id
              });

              logger.info(`Notification créée (ID: ${notifId}) pour user ${ownerId} - Like sur projet ${project_id}`);
            } catch (notifError) {
              logger.error('Erreur création notification:', notifError.message);
              logger.error('Stack:', notifError.stack);
            }
          } else {
            logger.info(`Notification skipped: ownerId=${ownerId}, user_id=${user_id}`);
          }
        }

        logger.info(`Like action: ${action} - Project ${project_id} by user ${user_id}`);

        res.json({
          success: true,
          action,
          message,
          data: {
            project_id,
            user_id,
            likes_count: updatedProject.likes_count || 0,
            user_has_liked: action === 'liked'
          }
        });

      } catch (error) {
        logger.error('Erreur dans like-manager:', error);
        res.status(500).json({
          error: 'Erreur interne du serveur',
          details: error.message
        });
      }
    });

    // GET /like-manager/status/:project_id - Vérifier le statut de like d'un projet
    router.get('/status/:project_id', async (req, res) => {
      try {
        const { project_id } = req.params;
        const user_id = req.accountability?.user;

        if (!user_id) {
          return res.status(401).json({ error: 'Authentification requise' });
        }

        const schema = await getSchema();
        const likesService = new ItemsService('projects_likes', { schema, accountability: req.accountability });
        const projectsService = new ItemsService('Projects', { schema, accountability: req.accountability });

        // Vérifier si l'user a liké ce projet
        const existingLikes = await likesService.readByQuery({
          filter: {
            project_id: { _eq: project_id },
            user_id: { _eq: user_id }
          }
        });

        // Récupérer le nombre total de likes
        const project = await projectsService.readOne(project_id, {
          fields: ['likes_count']
        });

        res.json({
          project_id,
          user_has_liked: existingLikes.length > 0,
          total_likes: project.likes_count || 0
        });

      } catch (error) {
        logger.error('Erreur status like-manager:', error);
        res.status(500).json({
          error: 'Erreur interne du serveur',
          details: error.message
        });
      }
    });

    // GET /like-manager/user-likes - Récupérer tous les projets likés par l'utilisateur
    router.get('/user-likes', async (req, res) => {
      try {
        const user_id = req.accountability?.user;

        if (!user_id) {
          return res.status(401).json({ error: 'Authentification requise' });
        }

        const schema = await getSchema();
        const likesService = new ItemsService('projects_likes', { schema, accountability: req.accountability });

        // Récupérer tous les likes de l'utilisateur avec les détails des projets
        const userLikes = await likesService.readByQuery({
          filter: {
            user_id: { _eq: user_id }
          },
          fields: ['id', 'project_id.*', 'date_created'],
          sort: ['-date_created']
        });

        res.json({
          success: true,
          data: userLikes,
          count: userLikes.length
        });

      } catch (error) {
        logger.error('Erreur user-likes:', error);
        res.status(500).json({
          error: 'Erreur interne du serveur',
          details: error.message
        });
      }
    });
  },
};
