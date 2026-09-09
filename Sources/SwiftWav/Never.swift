extension Never {
  public var body: Never {
    fatalError("Tried to access body of type `Never`")
  }
}