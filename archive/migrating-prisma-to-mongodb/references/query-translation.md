# Prisma to MongoDB Query Translation Reference

This guide provides query translation patterns from Prisma ORM to the native MongoDB driver.

---

## 1. Quick Syntax Comparison

| Prisma Pattern                                                        | Native MongoDB Equivalent                                                                                             |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `prisma.user.findUnique({ where: { id } })`                           | `col.findOne({ _id: idFilter(id) })`                                                                                  |
| `prisma.user.findFirst({ where: { email } })`                         | `col.findOne({ email })`                                                                                              |
| `prisma.user.findMany({ where: { email: { not: e } } })`              | `col.find({ email: { $ne: e } }).toArray()`                                                                           |
| `prisma.user.findMany({ where: { id: { in: ids } } })`                | `col.find({ _id: { $in: ids.map(idFilter) } }).toArray()`                                                             |
| `prisma.conv.findMany({ where: { userIds: { has: id } } })`           | `col.find({ userIds: id }).toArray()`                                                                                 |
| `prisma.conv.findFirst({ where: { userIds: { hasEvery: [a, b] } } })` | `col.findOne({ userIds: { $all: [a, b] } })`                                                                          |
| `prisma.msg.findMany({ orderBy: { createdAt: "asc" } })`              | `col.find().sort({ createdAt: 1 }).toArray()`                                                                         |
| `prisma.msg.create({ data: { body, senderId } })`                     | `col.insertOne({ body, senderId, createdAt: new Date() })`                                                            |
| `prisma.user.update({ where: { id }, data: { name } })`               | `col.findOneAndUpdate({ _id: idFilter(id) }, { $set: { name, updatedAt: new Date() } }, { returnDocument: "after" })` |
| `prisma.conv.delete({ where: { id } })`                               | `col.deleteOne({ _id: idFilter(id) })`                                                                                |

---

## 2. Array Modifications (Connect & Disconnect)

Prisma manages many-to-many relationship arrays with `connect` and `disconnect`. In native MongoDB, use `$addToSet` and `$pull`.

### Connecting / Appending Elements
```typescript
// Prisma:
// await prisma.message.update({
//   where: { id: messageId },
//   data: { seen: { connect: { id: userId } } }
// });

// Native MongoDB:
await getMessagesCollection().updateOne(
  { _id: idFilter(messageId) as any },
  { $addToSet: { seenIds: toObjectId(userId) } as any }
);
```

### Disconnecting / Removing Elements
```typescript
// Prisma:
// await prisma.conversation.update({
//   where: { id: conversationId },
//   data: { users: { disconnect: { id: userId } } }
// });

// Native MongoDB:
await getConversationsCollection().updateOne(
  { _id: idFilter(conversationId) as any },
  { $pull: { userIds: toObjectId(userId) } as any }
);
```

---

## 3. Relational Population (`include`)

Prisma automatically joins relations with `include: { users: true, messages: true }`. In a native MongoDB repository, use parallel multi-collection lookups or aggregation pipelines.

### Pattern A: Multi-Collection Fetch (Recommended for Next.js)
Simpler to type, cache, and test:

```typescript
async function findFullConversation(id: string): Promise<FullConversation | null> {
  const convDoc = await getConversationsCollection().findOne({ _id: idFilter(id) as any });
  if (!convDoc) return null;

  const conv = fromDoc<Conversation>(convDoc);
  const users = await userRepository.findManyByIds(conv.userIds);
  const messages = await messageRepository.findForConversation(conv.id);

  return {
    ...conv,
    users,
    messages,
  };
}
```

### Pattern B: Aggregation Pipeline (`$lookup`)
For high-volume operations requiring a single round-trip:

```typescript
const [result] = await getConversationsCollection().aggregate([
  { $match: { _id: idFilter(id) } },
  {
    $lookup: {
      from: "User",
      let: { userIds: "$userIds" },
      pipeline: [
        { $match: { $expr: { $in: ["$_id", "$$userIds"] } } }
      ],
      as: "users"
    }
  },
  {
    $lookup: {
      from: "Message",
      localField: "_id",
      foreignField: "conversationId",
      as: "messages"
    }
  }
]).toArray();
```

---

## 4. Cascade Deletions

Prisma applies cascade deletion via `@relation(onDelete: Cascade)` in `schema.prisma`. In MongoDB, manage cascades explicitly within repository methods:

```typescript
// db/repositories/conversation-repository.ts
async deleteForUser(conversationId: string, userId: string): Promise<boolean> {
  const conv = await this.findById(conversationId);
  if (!conv || !conv.userIds.includes(userId)) return false;

  // 1. Delete associated messages
  await getMessagesCollection().deleteMany({
    conversationId: idFilter(conversationId) as any,
  });

  // 2. Remove conversation from all participants
  await getUsersCollection().updateMany(
    { _id: { $in: conv.userIds.map(idFilter) } as any },
    { $pull: { conversationIds: toObjectId(conversationId) } as any }
  );

  // 3. Delete the conversation document
  const result = await getConversationsCollection().deleteOne({
    _id: idFilter(conversationId) as any,
  });

  return result.deletedCount > 0;
}
```

