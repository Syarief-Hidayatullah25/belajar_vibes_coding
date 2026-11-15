<?php

/**
 * Router untuk PHP built-in server saat development.
 *
 * Menyajikan file statis yang benar-benar ada (mis. /uploads/menus/*.png),
 * selain itu meneruskan request ke front controller Laravel.
 *
 * Pakai:
 *   php -S 127.0.0.1:8000 -t public server.php
 */
$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/');

if ($uri !== '/' && file_exists(__DIR__.'/public'.$uri) && ! is_dir(__DIR__.'/public'.$uri)) {
    return false;
}

require_once __DIR__.'/public/index.php';
