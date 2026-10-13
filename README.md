# json-parser

## Диалекты

```ts
import { parse } from "./src/index.ts";

parse('{"a": 1}');
parse('{"a": 1, /* comment */}', { dialect: "jsonc" });
parse("{a: 0x1F, b: 'text', c: .5, d: +Infinity,}", { dialect: "json5" });
```

| Диалект | Что добавляет |
|---|---|
| `json` | строгий RFC 8259, по умолчанию |
| `jsonc` | комментарии `//` и `/* */`, висячие запятые |
| `json5` | всё из `jsonc`, ключи-идентификаторы, одинарные кавычки, hex, `.5`, `5.`, `+1`, `Infinity`, `NaN`, escape `\x`, `\v`, `\0`, перенос строки через `\`, пробелы Unicode |

## Тесты

JSONTestSuite и json5-tests подключены как git-сабмодули в `vendor/`. После клонирования:

```bash
git submodule update --init --depth 1
npm test
```
