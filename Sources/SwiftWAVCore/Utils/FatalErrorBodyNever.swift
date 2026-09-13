func bodyFatalError<T>(_ type: T.Type = T.self) -> Never {
  fatalError("Tried to access '\(type)' but has no body.")
}
