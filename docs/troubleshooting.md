# Guide de dépannage

Ce guide vous aide à diagnostiquer et résoudre les problèmes courants avec Notploy.

## 🔍 Diagnostic rapide

### Script de diagnostic

```bash
#!/bin/bash
# scripts/diagnose.sh

echo "🔍 Diagnostic de Notploy..."

# Vérifier les services
echo "📊 Services en cours d'exécution :"
systemctl status notploy-app || echo "❌ Service notploy-app non trouvé"
systemctl status notploy-api || echo "❌ Service notploy-api non trouvé"
systemctl status docker || echo "❌ Docker non démarré"

# Vérifier les ports
echo "🌐 Ports utilisés :"
netstat -tlnp | grep :3000 || echo "❌ Port 3000 non utilisé"
netstat -tlnp | grep :3001 || echo "❌ Port 3001 non utilisé"

# Vérifier Docker
echo "🐳 État Docker :"
docker info > /dev/null 2>&1 && echo "✅ Docker accessible" || echo "❌ Docker inaccessible"

# Vérifier la base de données
echo "🗄️ Base de données :"
if [ -n "$DATABASE_URL" ]; then
    psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1 && echo "✅ Base de données accessible" || echo "❌ Base de données inaccessible"
else
    echo "❌ DATABASE_URL non défini"
fi

# Vérifier l'espace disque
echo "💾 Espace disque :"
df -h | grep -E "/$|/var" | head -2

# Vérifier la mémoire
echo "🧠 Mémoire :"
free -h

echo "🔍 Diagnostic terminé"
```

## 🚨 Problèmes courants

### 1. L'application ne démarre pas

#### Symptômes
- Page blanche ou erreur 502
- Service ne répond pas sur le port 3000
- Logs d'erreur au démarrage

#### Causes possibles
```bash
# Vérifier les logs
journalctl -u notploy-app -f
# ou
docker logs notploy-app

# Vérifier la configuration
cat apps/dokploy/.env | grep -E "(PORT|HOST|DATABASE_URL)"
```

#### Solutions

**Port déjà utilisé :**
```bash
# Trouver le processus
lsof -i :3000

# Tuer le processus
kill -9 <PID>

# Ou changer le port
echo "PORT=3001" >> apps/dokploy/.env
```

**Variables d'environnement manquantes :**
```bash
# Vérifier les variables requises
grep -r "process.env." apps/dokploy/server/ | cut -d'"' -f2 | sort -u

# Ajouter les variables manquantes
echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)" >> apps/dokploy/.env
```

**Base de données inaccessible :**
```bash
# Tester la connexion
psql "$DATABASE_URL" -c "SELECT 1;"

# Redémarrer PostgreSQL
sudo systemctl restart postgresql

# Vérifier les permissions
sudo -u postgres psql -c "\l"
```

### 2. Déploiement échoue

#### Symptômes
- Build Docker échoue
- Timeout de déploiement
- Erreur de pull d'image

#### Diagnostic
```bash
# Vérifier les logs de déploiement
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/deployments/{deploymentId}/logs

# Vérifier l'état Docker
docker ps
docker images

# Tester le build manuellement
cd /tmp/app
docker build -t test-build .
```

#### Solutions

**Dockerfile invalide :**
```dockerfile
# Dockerfile corrigé
FROM node:18-alpine AS builder

# Éviter les permissions root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]
```

**Timeout de build :**
```bash
# Augmenter le timeout dans .env
echo "BUILD_TIMEOUT=1800" >> apps/api/.env  # 30 minutes

# Optimiser le Dockerfile
# Utiliser le cache Docker
# Réduire la taille de l'image
```

**Espace disque insuffisant :**
```bash
# Nettoyer Docker
docker system prune -a
docker volume prune

# Vérifier l'espace
df -h
du -sh /var/lib/docker/
```

### 3. Problèmes de domaine/SSL

#### Symptômes
- Domaine inaccessible
- Erreur SSL/TLS
- Redirection incorrecte

#### Diagnostic
```bash
# Vérifier la configuration DNS
dig mon-app.com A
dig mon-app.com AAAA

# Vérifier les certificats
openssl s_client -connect mon-app.com:443 -servername mon-app.com

# Vérifier Traefik
docker logs traefik
curl http://localhost:8080/api/http/services
```

#### Solutions

**DNS incorrect :**
```bash
# Configuration DNS correcte
Type: A
Name: @
Value: IP_DU_SERVEUR
TTL: 300

# Ou CNAME
Type: CNAME
Name: www
Value: votre-notploy.com
```

**SSL non généré :**
```bash
# Forcer la génération SSL
curl -X POST http://localhost:3000/api/domains/{domainId}/renew-ssl

# Vérifier Let's Encrypt limits
curl https://acme-v02.api.letsencrypt.org/directory
```

### 4. Performance lente

#### Symptômes
- Temps de réponse élevé
- Timeout des requêtes
- CPU/memory élevés

#### Diagnostic
```bash
# Monitoring des ressources
htop
iotop
docker stats

# Analyse des performances
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000

# Vérifier les logs d'erreur
tail -f /var/log/notploy/app.log | grep ERROR
```

#### Solutions

**Optimisation des ressources :**
```yaml
# docker-compose.yml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G
```

**Base de données lente :**
```sql
-- Analyser les requêtes lentes
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Ajouter des index
EXPLAIN ANALYZE SELECT * FROM applications WHERE name = 'test';
```

**Cache activé :**
```bash
# Activer Redis
echo "REDIS_URL=redis://localhost:6379" >> apps/dokploy/.env

# Configurer le cache
echo "CACHE_TTL=3600" >> apps/dokploy/.env
```

## 🔧 Outils de dépannage

### Logs détaillés

```bash
# Activer les logs debug
echo "LOG_LEVEL=debug" >> apps/dokploy/.env

# Logs de tous les services
docker-compose logs -f
docker-compose logs -f app
docker-compose logs -f api
```

### Monitoring en temps réel

```bash
# Script de monitoring
#!/bin/bash
# scripts/monitor.sh

while true; do
    clear
    echo "📊 Monitoring Notploy - $(date)"
    echo "================================"
    
    # CPU et Memory
    echo "💻 Ressources système :"
    top -bn1 | head -5
    
    # Docker
    echo -e "\n🐳 Containers Docker :"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    # Services
    echo -e "\n🔧 Services :"
    systemctl status notploy-app --no-pager -l
    systemctl status notploy-api --no-pager -l
    
    # Ports
    echo -e "\n🌐 Ports actifs :"
    netstat -tlnp | grep -E ":(3000|3001|5432|6379)"
    
    sleep 5
done
```

### Tests de connectivité

```bash
# Test de l'API
curl -f http://localhost:3000/api/health || echo "❌ API inaccessible"

# Test de la base de données
psql "$DATABASE_URL" -c "SELECT NOW();" || echo "❌ BDD inaccessible"

# Test Docker
docker run --rm hello-world || echo "❌ Docker dysfonctionnel"
```

## 📋 Checklist de dépannage

### Au démarrage
- [ ] Docker installé et démarré
- [ ] Base de données accessible
- [ ] Variables d'environnement configurées
- [ ] Ports disponibles
- [ ] Permissions suffisantes

### Pour un déploiement
- [ ] Dockerfile valide
- [ ] Ressances suffisantes
- [ ] Réseau accessible
- [ ] Secrets disponibles
- [ ] Timeout approprié

### Pour les domaines
- [ ] DNS configuré
- [ ] Ports 80/443 ouverts
- [ ] Traefik fonctionnel
- [ ] Certificats SSL valides

### Pour la performance
- [ ] CPU/Memory disponibles
- [ ] Espace disque suffisant
- [ ] Base de données optimisée
- [ ] Cache configuré
- [ ] Load balancing actif

## 🆘 Obtenir de l'aide

### Collecte d'informations

```bash
# Script de collecte
#!/bin/bash
# scripts/collect-info.sh

echo "Collecte d'informations pour le support..."

# Créer l'archive
mkdir -p notploy-support
cd notploy-support

# Version
echo "=== Version ===" > info.txt
git rev-parse HEAD >> info.txt
cat package.json | grep version >> info.txt

# Configuration
echo -e "\n=== Configuration ===" >> info.txt
cat apps/dokploy/.env | grep -v "SECRET\|PASSWORD\|KEY" >> info.txt

# Logs récents
echo -e "\n=== Logs récents ===" >> info.txt
journalctl -u notploy-app --since "1 hour ago" >> info.txt

# État système
echo -e "\n=== État système ===" >> info.txt
df -h >> info.txt
free -h >> info.txt
docker ps >> info.txt

# Créer l'archive
cd ..
tar -czf notploy-support-$(date +%Y%m%d).tar.gz notploy-support/

echo "Archive créée : notploy-support-$(date +%Y%m%d).tar.gz"
```

### Signaler un problème

Quand vous ouvrez une issue, incluez :

1. **Description du problème**
2. **Étapes pour reproduire**
3. **Comportement attendu vs réel**
4. **Logs d'erreur**
5. **Configuration (sans les secrets)**
6. **Version de Notploy**
7. **Environnement (OS, Docker, etc.)**

### Ressources communautaires

- [GitHub Issues](https://github.com/votre-org/notploy/issues)
- [Discord Community](https://discord.gg/notploy)
- [Documentation](./README.md)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/notploy)

## 🔄 Maintenance préventive

### Tâches régulières

```bash
# Nettoyage hebdomadaire
#!/bin/bash
# scripts/maintenance.sh

echo "🧹 Maintenance Notploy..."

# Nettoyer Docker
docker system prune -f
docker volume prune -f

# Nettoyer les logs
find /var/log/notploy -name "*.log" -mtime +30 -delete

# Optimiser la base de données
psql "$DATABASE_URL" -c "VACUUM ANALYZE;"

# Vérifier les backups
find /var/backups/notploy -name "*.tar.gz" -mtime +7 -delete

echo "✅ Maintenance terminée"
```

### Monitoring des alertes

```bash
# Script d'alertes
#!/bin/bash
# scripts/alerts.sh

# Vérifier l'espace disque
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "⚠️ Espace disque critique : ${DISK_USAGE}%"
fi

# Vérifier la mémoire
MEM_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
if [ $MEM_USAGE -gt 90 ]; then
    echo "⚠️ Mémoire critique : ${MEM_USAGE}%"
fi

# Vérifier les services
if ! systemctl is-active --quiet notploy-app; then
    echo "⚠️ Service notploy-app arrêté"
fi
```

---

**Problème résolu !** 🎉 Si vous avez besoin d'aide supplémentaire, n'hésitez pas à contacter notre support.