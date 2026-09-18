#requires -Version 7.0
param([Parameter(Mandatory=$true)][string]$ArchivePath,[Parameter(Mandatory=$true)][string]$DestinationPath)
$ErrorActionPreference='Stop'
$archiveFull=[IO.Path]::GetFullPath($ArchivePath)
$destinationFull=[IO.Path]::GetFullPath($DestinationPath)
if (!(Test-Path -LiteralPath $archiveFull -PathType Leaf)) { throw 'Archive missing' }
if (Test-Path -LiteralPath $destinationFull) {
 if ((Get-ChildItem -LiteralPath $destinationFull -Force | Measure-Object).Count -ne 0) { throw 'Destination must be empty' }
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
# PowerShell 7 / modern .NET supports long Windows paths. No cleanup/deletion.
[IO.Compression.ZipFile]::ExtractToDirectory($archiveFull,$destinationFull)
