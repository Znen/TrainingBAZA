# Инструкция по развертыванию (Docker)

Поскольку у вас есть Docker, это самый простой способ запустить приложение где угодно (даже на Windows).

## 1. Подготовка
Убедитесь, что у вас создан файл `.env.local` (или просто `.env`) в корне проекта с ключами Supabase:

```bash
NEXT_PUBLIC_SUPABASE_URL=ваша_ссылка
NEXT_PUBLIC_SUPABASE_ANON_KEY=ваш_ключ
```

## 2. Запуск через Docker Compose

В терминале (в папке проекта):

```bash
# Сборка и запуск в фоновом режиме
docker-compose up -d --build
```

Приложение будет доступно по адресу: http://localhost:3000

## 3. Обновление
Если вы внесли изменения в код:

```bash
# Пересобрать и перезапустить
docker-compose up -d --build
```

## 4. Остановка
```bash
docker-compose down
```

## Дополнительно для Windows
Если вы используете Docker Desktop на Windows:
- Убедитесь, что Docker запущен.
- Если порты заняты, поменяйте в `docker-compose.yml`:
  ```yaml
  ports:
    - "3001:3000"  # Теперь будет доступно на localhost:3001
  ```
