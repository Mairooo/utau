export default {
  id: 'notifications-api',
  handler: (router, { services, database, getSchema, logger }) => {
    const { ItemsService } = services;

    // GET /notifications-api/ - Récupérer ses notifications
    router.get('/', async (req, res) => {
      try {
        const user_id = req.accountability?.user;

        if (!user_id) {
          return res.status(401).json({ error: 'Authentification requise' });
        }

        const schema = await getSchema();
        const notificationsService = new ItemsService('notifications', { 
          schema, 
          accountability: req.accountability 
        });

        const notifications = await notificationsService.readByQuery({
          filter: {
            user_id: { _eq: user_id }
          },
          fields: ['id', 'user_id', 'message', 'project_id', 'event_type', 'status', 'triggered_by', 'date_created'],
          sort: ['-date_created'],
          limit: 50
        });

        // Compter les non lues
        const unreadCount = notifications.filter(n => n.status === 'non_lu').length;

        res.json({
          success: true,
          data: notifications,
          unread_count: unreadCount,
          total: notifications.length
        });

      } catch (error) {
        logger.error('Erreur récupération notifications:', error);
        res.status(500).json({
          error: 'Erreur interne du serveur',
          details: error.message
        });
      }
    });

    // PATCH /notifications-api/:id/read - Marquer une notification comme lue
    router.patch('/:id/read', async (req, res) => {
      try {
        const { id } = req.params;
        const user_id = req.accountability?.user;

        if (!user_id) {
          return res.status(401).json({ error: 'Authentification requise' });
        }

        const schema = await getSchema();
        const notificationsService = new ItemsService('notifications', { 
          schema, 
          accountability: req.accountability 
        });

        // Vérifier que la notification appartient à l'utilisateur
        const notification = await notificationsService.readOne(id);
        
        if (!notification) {
          return res.status(404).json({ error: 'Notification non trouvée' });
        }

        if (notification.user_id !== user_id) {
          return res.status(403).json({ error: 'Accès non autorisé à cette notification' });
        }

        // Mettre à jour le statut
        await notificationsService.updateOne(id, {
          status: 'lu'
        });

        logger.info(`Notification ${id} marquée comme lue par user ${user_id}`);

        res.json({
          success: true,
          message: 'Notification marquée comme lue',
          data: { id, status: 'lu' }
        });

      } catch (error) {
        logger.error('Erreur marquage notification:', error);
        res.status(500).json({
          error: 'Erreur interne du serveur',
          details: error.message
        });
      }
    });

    // PATCH /notifications-api/read-all - Marquer toutes les notifications comme lues
    router.patch('/read-all', async (req, res) => {
      try {
        const user_id = req.accountability?.user;

        if (!user_id) {
          return res.status(401).json({ error: 'Authentification requise' });
        }

        const schema = await getSchema();
        const notificationsService = new ItemsService('notifications', { 
          schema, 
          accountability: req.accountability 
        });

        // Récupérer toutes les notifications non lues de l'utilisateur
        const unreadNotifications = await notificationsService.readByQuery({
          filter: {
            user_id: { _eq: user_id },
            status: { _eq: 'non_lu' }
          },
          fields: ['id']
        });

        // Mettre à jour chaque notification
        const ids = unreadNotifications.map(n => n.id);
        
        if (ids.length > 0) {
          await notificationsService.updateMany(ids, {
            status: 'lu'
          });
        }

        logger.info(`${ids.length} notifications marquées comme lues pour user ${user_id}`);

        res.json({
          success: true,
          message: `${ids.length} notification(s) marquée(s) comme lue(s)`,
          data: { updated_count: ids.length }
        });

      } catch (error) {
        logger.error('Erreur marquage toutes notifications:', error);
        res.status(500).json({
          error: 'Erreur interne du serveur',
          details: error.message
        });
      }
    });

    // DELETE /notifications-api/:id - Supprimer une notification
    router.delete('/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const user_id = req.accountability?.user;

        if (!user_id) {
          return res.status(401).json({ error: 'Authentification requise' });
        }

        const schema = await getSchema();
        const notificationsService = new ItemsService('notifications', { 
          schema, 
          accountability: req.accountability 
        });

        // Vérifier que la notification appartient à l'utilisateur
        const notification = await notificationsService.readOne(id);
        
        if (!notification) {
          return res.status(404).json({ error: 'Notification non trouvée' });
        }

        if (notification.user_id !== user_id) {
          return res.status(403).json({ error: 'Accès non autorisé à cette notification' });
        }

        // Supprimer la notification
        await notificationsService.deleteOne(id);

        logger.info(`Notification ${id} supprimée par user ${user_id}`);

        res.json({
          success: true,
          message: 'Notification supprimée'
        });

      } catch (error) {
        logger.error('Erreur suppression notification:', error);
        res.status(500).json({
          error: 'Erreur interne du serveur',
          details: error.message
        });
      }
    });
  }
};
