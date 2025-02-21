import { useDB } from '@tg-search/common'
import { sql } from 'drizzle-orm'

/**
 * Update message embedding in partition table
 */
export async function updateMessageEmbeddings(chatId: number, updates: Array<{ id: number, embedding: number[] }>) {
  const contentTable = `messages_${chatId}`

  // Update embeddings in batch
  await Promise.all(
    updates.map(async ({ id, embedding }) => {
      await useDB().execute(sql`
        UPDATE ${sql.identifier(contentTable)}
        SET embedding = ${sql.raw(`'[${embedding.join(',')}]'`)}::vector
        WHERE id = ${id} AND chat_id = ${chatId}
      `)
    }),
  )
}
