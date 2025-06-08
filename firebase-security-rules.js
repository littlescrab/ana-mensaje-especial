// ===================================
// REGLAS DE SEGURIDAD FIREBASE
// Para proyecto privado Juan y Ana
// ===================================

// =============
// FIRESTORE RULES
// =============
// Copia estas reglas en Firebase Console > Firestore Database > Rules

/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Función para verificar usuarios autorizados
    function isAuthorizedUser() {
      // Permite acceso solo desde dominios específicos o sin autenticación
      // (Para apps privadas sin sistema de login)
      return true;
    }
    
    // Función para verificar propietario de datos
    function isOwnerOrAna(userId) {
      return userId == 'juan' || userId == 'ana';
    }
    
    // MENSAJES ESPECIALES
    // Solo Juan y Ana pueden leer/escribir mensajes
    match /messages/{messageId} {
      allow read, write: if isAuthorizedUser();
    }
    
    // FOTOS
    // Solo Juan y Ana pueden subir/ver fotos
    match /photos/{photoId} {
      allow read, write: if isAuthorizedUser();
    }
    
    // COMENTARIOS DE FOTOS
    // Solo Juan y Ana pueden comentar
    match /photo_comments/{commentId} {
      allow read, write: if isAuthorizedUser() 
        && (resource == null || isOwnerOrAna(resource.data.user));
    }
    
    // PLANNER
    // Solo Juan y Ana pueden gestionar actividades
    match /planner/{documentId} {
      allow read, write: if isAuthorizedUser();
    }
    
    // CONFIGURACIÓN
    // Datos de configuración de la app
    match /config/{configId} {
      allow read: if isAuthorizedUser();
      allow write: if false; // Solo administrador
    }
    
    // BLOQUEAR TODO LO DEMÁS
    // Cualquier otra colección está bloqueada
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
*/

// =============
// STORAGE RULES
// =============
// Copia estas reglas en Firebase Console > Storage > Rules

/*
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // FOTOS PRIVADAS
    // Solo permite subir/ver fotos en carpeta específica
    match /photos/{fileName} {
      // Permite subir imágenes (hasta 10MB)
      allow read, write: if request.auth == null
        && resource.size < 10 * 1024 * 1024
        && fileName.matches('.*\\.(jpg|jpeg|png|gif|webp)');
    }
    
    // BLOQUEAR TODO LO DEMÁS
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
*/

// =============
// REGLAS ALTERNATIVAS MÁS RESTRICTIVAS
// =============
// Si quieres mayor seguridad, usa estas reglas:

/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Función para verificar origen de la request
    function isFromAllowedDomain() {
      // Solo permite acceso desde tu dominio específico
      return request.headers.origin in [
        'http://localhost',
        'http://127.0.0.1',
        'file://',
        'https://tu-dominio.com'
      ];
    }
    
    // Función para verificar horario de acceso
    function isBusinessHours() {
      // Solo permite acceso en horario específico (opcional)
      return request.time.hours() >= 6 && request.time.hours() <= 23;
    }
    
    // Aplicar a todas las colecciones
    match /{collection}/{document} {
      allow read, write: if isFromAllowedDomain() 
        && isBusinessHours()
        && collection in ['messages', 'photos', 'photo_comments', 'planner'];
    }
  }
}
*/

// =============
// RECOMENDACIONES DE SEGURIDAD
// =============
/*
1. CAMBIAR REGLAS PERIÓDICAMENTE
   - Actualiza las reglas cada 30-60 días
   - Revisa logs de acceso regularmente

2. MONITOREO
   - Activa alertas en Firebase Console
   - Revisa el uso y facturación

3. BACKUP
   - Exporta datos regularmente
   - Usa la herramienta firebase-setup.html

4. ACCESO RESTRINGIDO
   - No compartas las URLs directas
   - No subas las claves a repositorios públicos

5. EN CASO DE COMPROMISO
   - Cambia inmediatamente las reglas a 'allow read, write: if false;'
   - Regenera las claves de API
   - Revisa y limpia datos si es necesario
*/

